/**
 * Integration tests for submitWithDataFusion's parse-failure handling.
 *
 * The action used to call parseRecipeFromText unguarded, so an LLM parse failure
 * escaped the server action as an unhandled exception — the caller got a crash
 * with no `error.code` to branch on instead of a message. These tests pin the
 * typed errors it returns instead, and pin that no credit is spent when parsing
 * fails.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecipeParseError, TextTooLongError } from "@/lib/errors";

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  tasks: { trigger: vi.fn() },
  task: vi.fn((config: unknown) => config),
}));

vi.mock("@/lib/opt-out-cache", () => ({
  isCreatorOptedOut: vi.fn().mockResolvedValue(false),
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

vi.mock("@/lib/url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/url")>();
  return {
    ...actual,
    canonicalizeTikTokUrl: vi
      .fn()
      .mockImplementation(async (url: string) => url),
  };
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { submitWithDataFusion } from "@/actions/extraction";
import { db } from "@/db";
import { recipes, recipeCache } from "@/db/schema";
import { auth } from "@/lib/auth";
import { fetchOembedMetadata } from "@/trigger/strategies/oembed";
import { parseRecipeFromText } from "@/lib/recipe-parser";
import { tryConsumeUserAction } from "@/lib/user-limit";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_URL = "https://www.tiktok.com/@chef.mike/video/7234567890123456789";
const TRANSCRIPT = "First we sear the steak, then we rest it for ten minutes.";

/**
 * Signed-in user with credits, creator not opted out, oEmbed responding.
 *
 * `db.select` is only used here by `getUserCredits`, which awaits `.where()`
 * directly (no `.limit()`) and destructures an array.
 *
 * Returns `insertValuesMock`, shared across every `db.insert(...)` call
 * (recipes and recipe_cache aren't distinguished by table here) so a test can
 * inspect the payloads and count of whichever inserts actually happened.
 */
function mockReadyToParse({ credits = 3 }: { credits?: number } = {}) {
  vi.mocked(auth.api.getSession).mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  } as never);

  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ credits }]),
    }),
  } as never);

  vi.mocked(db.update).mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ credits: credits - 1 }]),
      }),
    }),
  } as never);

  const insertValuesMock = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([
      { id: "recipe-1", slug: "abc123def456", title: "Seared Steak" },
    ]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  });
  vi.mocked(db.insert).mockReturnValue({ values: insertValuesMock } as never);

  vi.mocked(fetchOembedMetadata).mockResolvedValue({
    title: "steak time",
    authorName: "Chef Mike",
    authorUrl: "https://www.tiktok.com/@chef.mike",
    thumbnailUrl: "https://example.com/thumb.jpg",
  });

  return { insertValuesMock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("submitWithDataFusion - parse failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a typed EXTRACTION_FAILED error when the LLM cannot parse a recipe", async () => {
    mockReadyToParse();
    vi.mocked(parseRecipeFromText).mockRejectedValue(
      new RecipeParseError("no recipe found", "steak time")
    );

    const result = await submitWithDataFusion(VALID_URL, TRANSCRIPT);

    expect(result).toHaveProperty("error");
    const { error } = result as { error: { code: string; message: string } };
    expect(error.code).toBe("EXTRACTION_FAILED");
    // The user supplied a transcript, so advice about signing in for audio
    // transcription would be wrong here.
    expect(error.message).not.toMatch(/sign in/i);
  });

  it("spends no credit and writes no recipe when parsing fails", async () => {
    mockReadyToParse();
    vi.mocked(parseRecipeFromText).mockRejectedValue(
      new RecipeParseError("no recipe found", "steak time")
    );

    await submitWithDataFusion(VALID_URL, TRANSCRIPT);

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns a distinct TEXT_TOO_LONG error when the combined text exceeds the limit", async () => {
    mockReadyToParse();
    vi.mocked(parseRecipeFromText).mockRejectedValue(
      new TextTooLongError(60_000)
    );

    const result = await submitWithDataFusion(VALID_URL, TRANSCRIPT);

    expect(result).toHaveProperty("error");
    const { error } = result as { error: { code: string; message: string } };
    expect(error.code).toBe("TEXT_TOO_LONG");
    expect(error.message).toMatch(/too long/i);
  });

  it("re-throws failures that are not parse failures", async () => {
    mockReadyToParse();
    vi.mocked(parseRecipeFromText).mockRejectedValue(
      new Error("openai connection reset")
    );

    // Anything that is not a recognised parse failure is a genuine fault and
    // must not be laundered into a user-facing message.
    await expect(submitWithDataFusion(VALID_URL, TRANSCRIPT)).rejects.toThrow(
      "openai connection reset"
    );
  });

  it("still succeeds and spends a credit when parsing works", async () => {
    mockReadyToParse();
    vi.mocked(parseRecipeFromText).mockResolvedValue({
      title: "Seared Steak",
      ingredients: [{ name: "steak", quantity: "1", unit: "" }],
      steps: ["Sear it", "Rest it"],
      tipsAndTricks: ["Rest for ten minutes"],
    });

    const result = await submitWithDataFusion(VALID_URL, TRANSCRIPT);

    expect(result).toHaveProperty("success", true);
    const { recipe } = result as { recipe: { slug: string } };
    expect(recipe.slug).toBe("abc123def456");
    // The decrement is the last step, so it only runs on the happy path.
    expect(db.update).toHaveBeenCalled();
  });

  it("returns INSUFFICIENT_CREDITS before attempting a parse", async () => {
    mockReadyToParse({ credits: 0 });

    const result = await submitWithDataFusion(VALID_URL, TRANSCRIPT);

    expect(result).toHaveProperty("error");
    const { error } = result as { error: { code: string } };
    expect(error.code).toBe("INSUFFICIENT_CREDITS");
    expect(parseRecipeFromText).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED before attempting a parse when over the limit", async () => {
    mockReadyToParse();
    vi.mocked(tryConsumeUserAction).mockResolvedValueOnce(false);

    const result = await submitWithDataFusion(VALID_URL, TRANSCRIPT);

    expect(result).toHaveProperty("error");
    const { error } = result as { error: { code: string } };
    expect(error.code).toBe("RATE_LIMITED");
    expect(parseRecipeFromText).not.toHaveBeenCalled();
  });
});

// ─── Client-transcript exposure ───────────────────────────────────────────────

/**
 * A client-supplied transcript is arbitrary browser-submitted text, parsed by
 * the LLM and attributed to a real creator's name and profile. These tests
 * pin that such a result never reaches recipe_cache (global, keyed only on
 * canonical URL — caching it would silently serve it to other users who
 * request the same URL) and is saved with isPublic: false (keeps it off the
 * public /r/[slug] share page, sitemap, and OG route).
 */
describe("submitWithDataFusion - client-transcript recipes stay private", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves isPublic: false and skips the cache insert when a transcript is supplied", async () => {
    const { insertValuesMock } = mockReadyToParse();
    vi.mocked(parseRecipeFromText).mockResolvedValue({
      title: "Seared Steak",
      ingredients: [{ name: "steak", quantity: "1", unit: "" }],
      steps: ["Sear it", "Rest it"],
      tipsAndTricks: ["Rest for ten minutes"],
    });

    await submitWithDataFusion(VALID_URL, TRANSCRIPT);

    // Only the recipe insert happens — no recipe_cache write.
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledWith(recipes);
    expect(db.insert).not.toHaveBeenCalledWith(recipeCache);

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: false, extractionStrategy: "data_fusion" })
    );
  });

  it("saves isPublic: true and caches the result when there is no transcript", async () => {
    const { insertValuesMock } = mockReadyToParse();
    vi.mocked(parseRecipeFromText).mockResolvedValue({
      title: "Seared Steak",
      ingredients: [{ name: "steak", quantity: "1", unit: "" }],
      steps: ["Sear it", "Rest it"],
      tipsAndTricks: ["Rest for ten minutes"],
    });

    await submitWithDataFusion(VALID_URL, undefined);

    // Both the recipe insert and the recipe_cache insert happen.
    expect(db.insert).toHaveBeenCalledTimes(2);
    expect(db.insert).toHaveBeenCalledWith(recipeCache);

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: true, extractionStrategy: "oembed_caption" })
    );
  });
});

// ─── Anonymous path ──────────────────────────────────────────────────────────

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
});
