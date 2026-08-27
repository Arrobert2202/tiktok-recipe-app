/**
 * Integration tests for the extraction server action (submitTikTokUrl).
 *
 * Validates: Requirements 1.1, 1.3, 2.1, 11.2, 13.2
 *
 * Mocks the DB layer, auth, next/headers, Trigger.dev, opt-out cache,
 * and oEmbed metadata fetcher to test the server action logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/db", () => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: vi.fn().mockResolvedValue({ id: "trigger-run-123" }),
  },
  // The refund tests below import the extraction job module, which calls task()
  // at module scope. Returning the config unchanged is enough — the tests exercise
  // the exported refund helper directly, not the task runner.
  task: vi.fn((config: unknown) => config),
}));

vi.mock("@/lib/opt-out-cache", () => ({
  isCreatorOptedOut: vi.fn(),
}));

vi.mock("@/lib/user-limit", () => ({
  tryConsumeUserAction: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/trigger/strategies/oembed", () => ({
  fetchOembedMetadata: vi.fn(),
}));

vi.mock("@/lib/recipe-parser", () => ({
  parseRecipeFromText: vi.fn(),
}));

// Mock canonicalizeTikTokUrl to avoid real network calls
vi.mock("@/lib/url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/url")>();
  return {
    ...actual,
    canonicalizeTikTokUrl: vi.fn().mockImplementation(async (url: string) => {
      // For long-form URLs, apply normal canonicalization logic
      const match = url.match(
        /^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([\w.]+)\/video\/(\d+)/
      );
      if (match) {
        return `https://www.tiktok.com/@${match[1]}/video/${match[2]}`;
      }
      // For short/mobile URLs, throw by default (tests can override)
      throw new Error("Could not resolve TikTok URL to canonical form");
    }),
  };
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { submitTikTokUrl } from "@/actions/extraction";
import { refundCreditForFailedJob } from "@/trigger/extraction-job";
import { db } from "@/db";
import { extractionJobs, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isCreatorOptedOut } from "@/lib/opt-out-cache";
import { fetchOembedMetadata } from "@/trigger/strategies/oembed";
import { canonicalizeTikTokUrl } from "@/lib/url";
import { tasks } from "@trigger.dev/sdk/v3";
import { tryConsumeUserAction } from "@/lib/user-limit";
import { parseRecipeFromText } from "@/lib/recipe-parser";
import { TextTooLongError, VideoUnavailableError } from "@/lib/errors";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_URL = "https://www.tiktok.com/@chef.mike/video/7234567890123456789";
const CANONICAL_URL = "https://www.tiktok.com/@chef.mike/video/7234567890123456789";

function mockAuthenticated() {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  } as any);
}

function mockUnauthenticated() {
  vi.mocked(auth.api.getSession).mockResolvedValue(null);
}

function mockNotOptedOut() {
  vi.mocked(isCreatorOptedOut).mockResolvedValue(false);
}

function mockOptedOut() {
  vi.mocked(isCreatorOptedOut).mockResolvedValue(true);
}

function mockNoCacheHit() {
  // db.select() for recipe cache returns empty
  const mockFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  });
  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
}

function mockCacheHit() {
  const recipeData = {
    id: "recipe-1",
    slug: "abc123",
    title: "Test Recipe",
    ingredients: [{ name: "flour", quantity: "2", unit: "cups" }],
    steps: ["Mix flour", "Bake"],
    sourceUrl: CANONICAL_URL,
    creatorHandle: "chef.mike",
    creatorDisplayName: "Chef Mike",
    creatorProfileUrl: "https://www.tiktok.com/@chef.mike",
    thumbnailUrl: "https://example.com/thumb.jpg",
    extractionStrategy: "oembed_caption",
    extractionDurationMs: 1200,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  // First call: recipe cache lookup — .where().orderBy().limit()
  const mockCacheFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ recipeId: "recipe-1" }]),
      }),
    }),
  });

  // Second call: recipe lookup by ID
  const mockRecipeFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([recipeData]),
    }),
  });

  let callCount = 0;
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return { from: mockCacheFrom } as any;
    }
    return { from: mockRecipeFrom } as any;
  });
}

function mockNoExistingJob() {
  // This is for the second db.select call (after cache miss)
  // We need both: cache miss (first select) + no existing job (second select)
  const mockFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    }),
  });

  vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);
}

function mockExistingInProgressJob() {
  let callCount = 0;

  // First call: cache miss (.where().orderBy().limit()), second call:
  // existing job found (.where().limit())
  vi.mocked(db.select).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // Cache miss
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any;
    }
    // Existing in-progress job
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { id: "existing-job-1", status: "processing" },
          ]),
        }),
      }),
    } as any;
  });
}

// Captured so tests can assert on the values passed to db.insert(...).values(...)
let insertValuesMock: ReturnType<typeof vi.fn>;

/**
 * Mocks the full cache-miss path: no cached recipe, no in-progress job, and a
 * user with `credits` remaining.
 *
 * db.select is called twice in sequence by submitTikTokUrl:
 *   1. recipe cache lookup      → .from().where().limit()  → []
 *   2. in-progress job lookup   → .from().where().limit()  → []
 *
 * The credit check and charge are a single `claimCredit` call — one
 * db.update(users).set(...).where(...).returning(...) — rather than a
 * separate SELECT. A `credits` of 0 simulates the WHERE clause (id AND
 * credits > 0) matching no rows, the same as a real database.
 */
function mockNewJobCreation({ credits = 3 }: { credits?: number } = {}) {
  // Shared across both select calls: the cache lookup chains .orderBy()
  // before .limit(), the job-dedupe lookup goes straight to .limit() — this
  // stub exposes both so the same mock works for either shape.
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  } as any);

  // claimCredit: db.update(users).set(...).where(...).returning(...)
  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(
          credits > 0 ? [{ credits: credits - 1 }] : []
        ),
      }),
    }),
  } as any);

  // db.insert returns new job
  insertValuesMock = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: "new-job-1" }]),
  });
  vi.mocked(db.insert).mockReturnValue({ values: insertValuesMock } as any);

  vi.mocked(fetchOembedMetadata).mockResolvedValue({
    title: "Chef Mike's Recipe",
    authorName: "Chef Mike",
    authorUrl: "https://www.tiktok.com/@chef.mike",
    thumbnailUrl: "https://example.com/thumb.jpg",
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("submitTikTokUrl - extraction flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("URL validation", () => {
    it("returns INVALID_URL error for non-TikTok URLs", async () => {
      const result = await submitTikTokUrl("https://youtube.com/watch?v=abc");
      expect(result).toEqual({
        error: {
          code: "INVALID_URL",
          message: "Please enter a valid TikTok video URL",
        },
      });
    });

    it("returns INVALID_URL error for empty string", async () => {
      const result = await submitTikTokUrl("");
      expect(result).toEqual({
        error: {
          code: "INVALID_URL",
          message: "Please enter a valid TikTok video URL",
        },
      });
    });

    it("rejects URLs exceeding 2048 characters at the validation gate", async () => {
      // validateTikTokUrl itself rejects URLs > 2048, so INVALID_URL fires first.
      // This verifies the length limit is enforced early.
      const baseUrl = "https://www.tiktok.com/@chef.mike/video/7234567890123456789?";
      const longParam = "x=" + "a".repeat(2048 - baseUrl.length + 10);
      const longUrl = baseUrl + longParam;

      expect(longUrl.length).toBeGreaterThan(2048);

      const result = await submitTikTokUrl(longUrl);
      expect(result).toHaveProperty("error");
      const errorResult = result as { error: { code: string } };
      // The URL is rejected at the validation step (which includes a length check)
      expect(errorResult.error.code).toBe("INVALID_URL");
    });
  });

  describe("authentication", () => {
    it("returns UNAUTHORIZED error when user is not authenticated", async () => {
      mockUnauthenticated();

      const result = await submitTikTokUrl(VALID_URL);
      expect(result).toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "You must be signed in to extract recipes",
        },
      });
    });
  });

  describe("creator opt-out gating", () => {
    it("returns CREATOR_OPTED_OUT error when creator has opted out", async () => {
      mockAuthenticated();
      mockOptedOut();

      const result = await submitTikTokUrl(VALID_URL);
      expect(result).toEqual({
        error: {
          code: "CREATOR_OPTED_OUT",
          message: "This creator has opted out of recipe extraction",
        },
      });
    });
  });

  describe("cache hit", () => {
    it("returns cached recipe immediately when cache hit", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockCacheHit();

      const result = await submitTikTokUrl(VALID_URL);

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("recipe");
      const successResult = result as { success: true; recipe: any };
      expect(successResult.recipe.id).toBe("recipe-1");
      expect(successResult.recipe.title).toBe("Test Recipe");
      expect(successResult.recipe.creatorHandle).toBe("chef.mike");
    });
  });

  describe("existing in-progress job", () => {
    it("returns existing job ID when extraction is already in progress", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockExistingInProgressJob();

      const result = await submitTikTokUrl(VALID_URL);

      expect(result).toHaveProperty("success", true);
      const successResult = result as { success: true; jobId: string; status: string };
      expect(successResult.jobId).toBe("existing-job-1");
      expect(successResult.status).toBe("processing");
    });
  });

  describe("new extraction", () => {
    it("creates job record, triggers Trigger.dev task, and returns job ID", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockNewJobCreation();

      const result = await submitTikTokUrl(VALID_URL);

      expect(result).toHaveProperty("success", true);
      const successResult = result as { success: true; jobId: string; status: string };
      expect(successResult.jobId).toBe("new-job-1");
      expect(successResult.status).toBe("pending");

      // Verify db.insert was called to create a job row for this user/URL
      expect(db.insert).toHaveBeenCalled();
      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          url: VALID_URL,
          canonicalUrl: CANONICAL_URL,
          status: "pending",
        })
      );

      // Verify Trigger.dev task was triggered
      expect(tasks.trigger).toHaveBeenCalledWith(
        "extraction-job",
        expect.objectContaining({
          jobId: "new-job-1",
          canonicalUrl: CANONICAL_URL,
          userId: "user-1",
          creatorHandle: "chef.mike",
        })
      );
    });
  });

  describe("credit gate", () => {
    it("returns INSUFFICIENT_CREDITS without triggering extraction when user has 0 credits", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockNewJobCreation({ credits: 0 });

      const result = await submitTikTokUrl(VALID_URL);

      expect(result).toEqual({
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: "You've used all your credits. Buy more to keep extracting recipes.",
        },
      });

      // The atomic claim still issues its UPDATE (that's how the database
      // tells "zero credits" from "row disappeared"), but it claims nothing,
      // and nothing downstream of it runs: no job row, no task.
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.insert).not.toHaveBeenCalled();
      expect(tasks.trigger).not.toHaveBeenCalled();
    });

    it("issues the credit claim as a single atomic UPDATE guarded by credits > 0", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockNewJobCreation({ credits: 3 });

      await submitTikTokUrl(VALID_URL);

      // One UPDATE does the whole claim — no preceding SELECT reads the
      // balance, which is what makes it safe under concurrent submissions.
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledWith(users);
    });
  });

  describe("rate limit", () => {
    it("returns RATE_LIMITED without canonicalizing or spending a credit when over the limit", async () => {
      mockAuthenticated();
      vi.mocked(tryConsumeUserAction).mockResolvedValueOnce(false);

      const result = await submitTikTokUrl(VALID_URL);

      expect(result).toEqual({
        error: {
          code: "RATE_LIMITED",
          message: "Too many extraction attempts. Please wait a bit and try again.",
        },
      });

      // Rejected before any of the expensive/paid work below it runs.
      expect(canonicalizeTikTokUrl).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
      expect(tasks.trigger).not.toHaveBeenCalled();
    });
  });

  describe("short/mobile URL canonicalization failure", () => {
    it("returns CANONICALIZATION_FAILED error for unresolvable short URLs", async () => {
      mockAuthenticated();

      // Override canonicalizeTikTokUrl to throw for this test's URL only —
      // mockRejectedValueOnce so it doesn't leak into tests declared after
      // this one (vi.clearAllMocks() in beforeEach clears call history, not
      // a previously-set mock implementation).
      vi.mocked(canonicalizeTikTokUrl).mockRejectedValueOnce(
        new Error("Could not resolve TikTok URL to canonical form")
      );

      const shortUrl = "https://vm.tiktok.com/ZMxxxxxx";
      const result = await submitTikTokUrl(shortUrl);

      expect(result).toEqual({
        error: {
          code: "CANONICALIZATION_FAILED",
          message: "Could not resolve the TikTok URL to its canonical form",
        },
      });
    });
  });

  // Step 5's consolidation: the video-upload "better accuracy" feature
  // (formerly the separate submitWithDataFusion action) now rides along as
  // an extra input to this same job pipeline instead of running its own
  // synchronous insert.
  describe("clientTranscript (video-upload path folded into this pipeline)", () => {
    it("includes clientTranscript in the trigger payload when provided", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockNewJobCreation();

      await submitTikTokUrl(VALID_URL, undefined, "Sear the steak, rest ten minutes.");

      expect(tasks.trigger).toHaveBeenCalledWith(
        "extraction-job",
        expect.objectContaining({ clientTranscript: "Sear the steak, rest ten minutes." })
      );
    });

    it("omits clientTranscript from the payload when not provided", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockNewJobCreation();

      await submitTikTokUrl(VALID_URL);

      const payload = vi.mocked(tasks.trigger).mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("clientTranscript");
    });

    it("skips the in-progress-job dedupe when a transcript is provided, creating a fresh job instead of reusing someone else's", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      // Cache miss, then an existing in-progress job for the same URL —
      // ordinarily this would short-circuit with that job's ID (see the
      // "existing in-progress job" tests above). With a transcript, that
      // dedupe hit must never even be looked at.
      mockExistingInProgressJob();
      // mockExistingInProgressJob only wires the first two db.select calls
      // (cache miss, dedupe hit) and doesn't set up credit claim/insert —
      // provide those separately so the fresh-job path can complete.
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ credits: 2 }]),
          }),
        }),
      } as any);
      insertValuesMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "fresh-job-1" }]),
      });
      vi.mocked(db.insert).mockReturnValue({ values: insertValuesMock } as any);

      const result = await submitTikTokUrl(VALID_URL, undefined, "a transcript");

      expect(result).toHaveProperty("success", true);
      const successResult = result as { success: true; jobId: string };
      // Not "existing-job-1" — the dedupe hit that would otherwise apply.
      expect(successResult.jobId).toBe("fresh-job-1");
      expect(tasks.trigger).toHaveBeenCalled();
    });

    it("returns TEXT_TOO_LONG before claiming a credit when the transcript exceeds 50,000 characters", async () => {
      mockAuthenticated();
      mockNotOptedOut();
      mockNewJobCreation();

      const oversized = "a".repeat(50_001);
      const result = await submitTikTokUrl(VALID_URL, undefined, oversized);

      expect(result).toEqual({
        error: {
          code: "TEXT_TOO_LONG",
          message: "This video is too long to process. Try a shorter video.",
        },
      });
      // Rejected before the credit claim and before triggering any job —
      // this is a coarse pre-check specifically to avoid a pointless
      // claim -> trigger -> job -> fail -> refund round-trip for a failure
      // that's knowable synchronously.
      expect(db.update).not.toHaveBeenCalled();
      expect(tasks.trigger).not.toHaveBeenCalled();
    });
  });
});

// ─── Anonymous path: oversized caption ─────────────────────────────────────

/**
 * `submitAnonymousUrl` already converted RecipeParseError into THIN_CAPTION, but
 * its catch re-threw everything else — and parseRecipeFromText rethrows
 * TextTooLongError untouched from its own catch, so it arrived unwrapped and
 * escaped the action.
 */
describe("submitAnonymousUrl - oversized caption handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a typed TEXT_TOO_LONG error instead of throwing", async () => {
    const { submitAnonymousUrl } = await import("@/actions/extraction");

    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    // Cache lookup: miss. .where().orderBy().limit()
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as never);

    vi.mocked(fetchOembedMetadata).mockResolvedValue({
      title: "a very long caption",
      authorName: "Chef Mike",
      authorUrl: "https://www.tiktok.com/@chef.mike",
      thumbnailUrl: "https://example.com/thumb.jpg",
    });

    vi.mocked(parseRecipeFromText).mockRejectedValue(
      new TextTooLongError(60_000)
    );

    const result = await submitAnonymousUrl(VALID_URL);

    expect(result).toHaveProperty("error");
    const { error } = result as { error: { code: string; message: string } };
    expect(error.code).toBe("TEXT_TOO_LONG");
    expect(error.message).toMatch(/too long/i);
  });

  it("returns a specific VIDEO_UNAVAILABLE error instead of the generic 'no description' message", async () => {
    // This is the anonymous path's only fetch attempt — no async job behind
    // it to retry from — so a private/deleted/rate-limited video needs its
    // own message here rather than being misread as "this video just has no
    // caption text".
    const { submitAnonymousUrl } = await import("@/actions/extraction");

    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as never);

    vi.mocked(fetchOembedMetadata).mockRejectedValue(
      new VideoUnavailableError("private_or_deleted", "oEmbed returned 404")
    );

    const result = await submitAnonymousUrl(VALID_URL);

    expect(result).toHaveProperty("error");
    const { error } = result as { error: { code: string; message: string } };
    expect(error.code).toBe("VIDEO_UNAVAILABLE");
    expect(error.message).toBe(
      "This video is private, deleted, or no longer available. Double-check the link, or try a different video."
    );
  });
});

// ─── Failure refund ──────────────────────────────────────────────────────────

/**
 * Walks a drizzle SQL tree and collects every column name it references.
 * Used to prove the idempotency guard lives in the WHERE clause — i.e. the
 * database decides who wins — rather than in an application-side if/else.
 */
function collectColumnNames(node: unknown, out: string[] = []): string[] {
  const n = node as { name?: string; queryChunks?: unknown[] };
  if (n && typeof n === "object") {
    if (typeof n.name === "string") out.push(n.name);
    if (Array.isArray(n.queryChunks)) {
      for (const chunk of n.queryChunks) collectColumnNames(chunk, out);
    }
  }
  return out;
}

/**
 * Routes db.update by table so the claim (extraction_jobs) and the balance
 * change (users) can be told apart.
 *
 * `claimResults` is a queue of what the guarded UPDATE ... RETURNING yields on
 * each successive call, which is how a real database behaves: the first caller to
 * flip credit_refunded gets its row back, later callers match nothing.
 */
function mockRefundPath(claimResults: Array<Array<{ id: string }>>) {
  const claimSetPayloads: Array<Record<string, unknown>> = [];
  const claimWhereClauses: unknown[] = [];
  const creditSetPayloads: Array<Record<string, unknown>> = [];
  let claimCall = 0;

  vi.mocked(db.update).mockImplementation((table: unknown) => {
    if (table === extractionJobs) {
      return {
        set: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          claimSetPayloads.push(payload);
          return {
            where: vi.fn().mockImplementation((clause: unknown) => {
              claimWhereClauses.push(clause);
              const result = claimResults[claimCall] ?? [];
              claimCall++;
              return { returning: vi.fn().mockResolvedValue(result) };
            }),
          };
        }),
      } as never;
    }

    if (table === users) {
      return {
        set: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          creditSetPayloads.push(payload);
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ credits: 3 }]),
            }),
          };
        }),
      } as never;
    }

    throw new Error("db.update called with an unexpected table");
  });

  return { claimSetPayloads, claimWhereClauses, creditSetPayloads };
}

describe("refundCreditForFailedJob - exactly-once credit refund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues exactly one refund when the guarded update claims a row", async () => {
    const { creditSetPayloads } = mockRefundPath([[{ id: "job-1" }]]);

    const refunded = await refundCreditForFailedJob("job-1", "user-1");

    expect(refunded).toBe(true);
    expect(creditSetPayloads).toHaveLength(1);
  });

  it("issues no refund when the guarded update claims zero rows", async () => {
    const { creditSetPayloads } = mockRefundPath([[]]);

    const refunded = await refundCreditForFailedJob("job-1", "user-1");

    expect(refunded).toBe(false);
    // The user's balance was never touched — this is what stops a replayed
    // failure handler from minting credits.
    expect(creditSetPayloads).toHaveLength(0);
  });

  it("refunds only once when the failure handler runs repeatedly", async () => {
    // First invocation wins the claim; every later one finds credit_refunded
    // already true and matches nothing.
    const { creditSetPayloads } = mockRefundPath([[{ id: "job-1" }], [], []]);

    const first = await refundCreditForFailedJob("job-1", "user-1");
    const second = await refundCreditForFailedJob("job-1", "user-1");
    const third = await refundCreditForFailedJob("job-1", "user-1");

    expect([first, second, third]).toEqual([true, false, false]);
    expect(creditSetPayloads).toHaveLength(1);
  });

  it("claims the refund by flipping creditRefunded, gated on it being false", async () => {
    const { claimSetPayloads, claimWhereClauses } = mockRefundPath([[{ id: "job-1" }]]);

    await refundCreditForFailedJob("job-1", "user-1");

    expect(claimSetPayloads[0]).toMatchObject({ creditRefunded: true });

    // The guard must be part of the statement the database evaluates, otherwise
    // two concurrent handlers could both read false and both refund.
    const columns = collectColumnNames(claimWhereClauses[0]);
    expect(columns).toContain("credit_refunded");
    expect(columns).toContain("id");
  });

  it("credits the user in the payload, using a DB-side increment", async () => {
    const { creditSetPayloads } = mockRefundPath([[{ id: "job-1" }]]);

    await refundCreditForFailedJob("job-1", "user-7");

    const columns = collectColumnNames(creditSetPayloads[0].credits);
    expect(columns).toContain("credits");
  });
});
