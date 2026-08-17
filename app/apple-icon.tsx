import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/icon-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — 180x180 is what iOS asks for on the home screen. */
export default function AppleIcon() {
  return new ImageResponse(<IconArt size={size.width} />, size);
}
