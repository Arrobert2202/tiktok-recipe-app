import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/icon-art";

/**
 * Only the sizes the manifest actually references. Anything else 404s rather
 * than letting a crawler make us rasterise arbitrary dimensions on demand.
 */
const ALLOWED_SIZES = ["192", "512"] as const;

type AllowedSize = (typeof ALLOWED_SIZES)[number];

function isAllowedSize(value: string): value is AllowedSize {
  return (ALLOWED_SIZES as readonly string[]).includes(value);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;

  if (!isAllowedSize(size)) {
    return new Response("Not found", { status: 404 });
  }

  const px = Number(size);

  return new ImageResponse(<IconArt size={px} />, {
    width: px,
    height: px,
    headers: {
      // Content only changes on deploy, and installers refetch rarely.
      "Cache-Control": "public, max-age=86400",
    },
  });
}
