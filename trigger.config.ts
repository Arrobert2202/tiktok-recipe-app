import { defineConfig } from "@trigger.dev/sdk/v3";
import { ffmpeg } from "@trigger.dev/build/extensions/core";
import type { BuildExtension } from "@trigger.dev/build";

/**
 * Installs the standalone yt-dlp binary into the deployed worker image.
 *
 * Why not `aptGet({ packages: ["yt-dlp"] })`:
 * the Debian package lags upstream badly. TikTok changes its page structure
 * often and yt-dlp ships extractor fixes continuously, so a stale yt-dlp
 * breaks extraction within weeks. We pull the latest release at image build
 * time instead.
 *
 * Why the `yt-dlp_linux` asset and not plain `yt-dlp`:
 * the plain `yt-dlp` release asset is a platform-independent zipimport binary
 * that requires Python on the host. The deploy base image is
 * `node:*-bookworm-slim`, which has no python3 in the runtime stage (python3 is
 * only installed in the intermediate `build` stage). `yt-dlp_linux` is the
 * self-contained standalone build with Python bundled in, so it runs as-is.
 *
 * Why curl + ca-certificates are installed here rather than via `aptGet()`:
 * `image.instructions` are emitted immediately after `FROM <base> AS base`,
 * *before* the single apt-get line that installs everything from `image.pkgs`.
 * So a separate `aptGet({ packages: ["curl"] })` layer would resolve too late
 * to be usable here. Installing prerequisites inside this same RUN keeps the
 * layer self-contained and independent of extension ordering. This mirrors what
 * the official ffmpeg static-build extension does.
 */
function ytDlp(): BuildExtension {
  return {
    name: "yt-dlp",
    onBuildComplete(context) {
      // Local `dev` runs use the machine's own yt-dlp (e.g. Homebrew).
      if (context.target === "dev") {
        return;
      }

      context.logger.debug("Adding yt-dlp");

      context.addLayer({
        id: "yt-dlp",
        image: {
          instructions: [
            [
              // `DEBIAN_FRONTEND` is set by the generated Containerfile only
              // *after* these instructions, so set it explicitly here.
              "RUN export DEBIAN_FRONTEND=noninteractive",
              "apt-get update",
              "apt-get install -y --no-install-recommends ca-certificates curl",
              "apt-get clean",
              "rm -rf /var/lib/apt/lists/*",
              // Pick the asset matching the image architecture.
              'ASSET="yt-dlp_linux"',
              'if [ "$(uname -m)" = "aarch64" ]; then ASSET="yt-dlp_linux_aarch64"; fi',
              // `-f` matters: without it a non-200 response would be written to
              // disk and marked executable, producing a binary that fails in a
              // confusing way at runtime instead of failing the build.
              'curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$ASSET" -o /usr/local/bin/yt-dlp',
              "chmod a+rx /usr/local/bin/yt-dlp",
              // Fail the build now if the binary can't execute.
              "/usr/local/bin/yt-dlp --version",
            ].join(" && "),
          ],
        },
        deploy: {
          env: {
            YT_DLP_PATH: "/usr/local/bin/yt-dlp",
          },
          override: true,
        },
      });
    },
  };
}

export default defineConfig({
  project: "proj_mclwzafqqyzkncyodxlu",
  maxDuration: 120,
  dirs: ["./trigger"],
  build: {
    // ffmpeg is required because the extractor runs yt-dlp with
    // `--extract-audio --audio-format m4a`, which post-processes via ffmpeg.
    // The extension also sets FFMPEG_PATH / FFPROBE_PATH.
    extensions: [ffmpeg(), ytDlp()],
  },
});
