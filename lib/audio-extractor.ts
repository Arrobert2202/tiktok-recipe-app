import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";
import { VideoUnavailableError } from "@/lib/errors";

const execFileAsync = promisify(execFile);

/**
 * Resolves the yt-dlp executable.
 *
 * In the deployed worker image the binary is installed to /usr/local/bin and
 * YT_DLP_PATH is set by the build extension. Locally it's whatever is on PATH
 * (e.g. a Homebrew install), so plain "yt-dlp" is the right fallback.
 */
function resolveYtDlpPath(): string {
  return process.env.YT_DLP_PATH?.trim() || "yt-dlp";
}

/** True when a spawn failed because the executable wasn't found. */
function isMissingBinaryError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

function missingBinaryError(binary: string): Error {
  return new Error(
    `yt-dlp was not found (tried "${binary}"). Install yt-dlp and ensure it is on PATH, ` +
      `or set YT_DLP_PATH to its absolute location.`
  );
}

/**
 * Best-effort read of a yt-dlp failure from its stderr text. yt-dlp's exact
 * wording shifts with TikTok's site changes and its own releases, so this
 * matches on the stable, generic substrings rather than a specific phrase —
 * returns null (truly unknown) rather than guess when nothing matches.
 */
export function classifyYtDlpFailure(stderrOrMessage: string): "private_or_deleted" | "rate_limited" | null {
  const text = stderrOrMessage.toLowerCase();
  if (
    text.includes("private") ||
    text.includes("unavailable") ||
    text.includes("not available") ||
    text.includes("removed") ||
    text.includes("does not exist")
  ) {
    return "private_or_deleted";
  }
  if (text.includes("429") || text.includes("too many requests") || text.includes("rate limit")) {
    return "rate_limited";
  }
  return null;
}

/**
 * Downloads audio from a TikTok video URL using yt-dlp.
 * Returns the audio as a Buffer (m4a format).
 *
 * Timeout: 30 seconds
 * This runs yt-dlp as a subprocess — requires yt-dlp to be installed on the system.
 */
export async function extractAudioFromUrl(url: string): Promise<{ buffer: Buffer; filename: string }> {
  const outputId = randomUUID();
  const outputPath = join(tmpdir(), `tiktok-audio-${outputId}.m4a`);
  const ytDlp = resolveYtDlpPath();

  try {
    // Download audio only, best quality audio, output to temp file
    try {
      await execFileAsync(ytDlp, [
        "--no-warnings",
        "--extract-audio",
        "--audio-format", "m4a",
        "--audio-quality", "0",
        "--output", outputPath,
        "--no-playlist",
        "--socket-timeout", "15",
        url,
      ], { timeout: 30_000 });
    } catch (err) {
      if (isMissingBinaryError(err)) {
        throw missingBinaryError(ytDlp);
      }
      const stderr = (err as { stderr?: string })?.stderr ?? "";
      const message = err instanceof Error ? err.message : String(err);
      const reason = classifyYtDlpFailure(stderr) ?? classifyYtDlpFailure(message);
      if (reason) {
        throw new VideoUnavailableError(reason, `yt-dlp: ${stderr || message}`.slice(0, 300));
      }
      throw err;
    }

    // Read the file into memory
    const buffer = await readFile(outputPath);

    return { buffer, filename: `audio-${outputId}.m4a` };
  } finally {
    // Clean up temp file
    try {
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Checks if yt-dlp is available on the system.
 */
export async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await execFileAsync(resolveYtDlpPath(), ["--version"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
