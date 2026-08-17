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
import { auth } from "@/lib/auth";
import { fetchOembedMetadata } from "@/trigger/strategies/oembed";
import { parseRecipeFromText } from "@/lib/recipe-parser";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_URL = "https://www.tiktok.com/@chef.mike/video/7234567890123456789";
const TRANSCRIPT = "First we sear the steak, then we rest it for ten minutes.";

/**
 * Signed-in user with credits, creator not opted out, oEmbed responding.
 *
 * `db.select` is only used here by `getUserCredits`, which awaits `.where()`
 * directly (no `.limit()`) and destructures an array.
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

  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        { id: "recipe-1", slug: "abc123def456", title: "Seared Steak" },
      ]),
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  } as never);

  vi.mocked(fetchOembedMetadata).mockResolvedValue({
    title: "steak time",
    authorName: "Chef Mike",
    authorUrl: "https://www.tiktok.com/@chef.mike",
    thumbnailUrl: "https://example.com/thumb.jpg",
  });
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

    // Cache lookup: miss.
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
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
