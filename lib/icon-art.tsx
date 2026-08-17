/**
 * Shared artwork for every generated app icon: the favicon (`app/icon.tsx`),
 * the Apple touch icon (`app/apple-icon.tsx`), and the manifest sizes served
 * from `app/icons/[size]/route.tsx`.
 *
 * This markup is rasterised by Satori (via `next/og`), not by a browser, so it
 * deliberately sticks to inline styles and primitive SVG shapes. No Tailwind
 * classes, no external CSS, no complex path data.
 */

type IconArtProps = {
  /** Rendered width and height in pixels. App icons are always square. */
  size: number;
};

/**
 * Purple-to-pink gradient tile with a white chef hat centred on it.
 *
 * The background is fully opaque on purpose. Android composites a maskable
 * icon without supplying a backdrop of its own, so a transparent background
 * shows up as a glyph floating on whatever the launcher happens to draw.
 */
export function IconArt({ size }: IconArtProps) {
  // Maskable icons are cropped to a circle (or squircle) by the launcher, so
  // the glyph stays inside the middle ~66%, comfortably within the safe zone.
  const glyphSize = Math.round(size * 0.66);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Bleeds to all four edges, no border radius. Rounded corners would be
        // transparent, and the launcher applies its own mask regardless — so a
        // pre-rounded tile either gets rounded twice or shows the launcher's
        // wallpaper through the gaps.
        backgroundColor: "#9333ea",
        backgroundImage: "linear-gradient(135deg, #9333ea 0%, #ec4899 100%)",
      }}
    >
      <ChefHatGlyph size={glyphSize} />
    </div>
  );
}

/**
 * Chef hat built from circles and rounded rectangles rather than one traced
 * path. Primitive shapes are the part of SVG that Satori forwards to resvg
 * most predictably, and legibility at 192px matters more than an exact outline.
 */
function ChefHatGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* Puff: three overlapping circles, squared off at the base by a rect */}
      <circle cx="30" cy="42" r="20" fill="#ffffff" />
      <circle cx="50" cy="35" r="23" fill="#ffffff" />
      <circle cx="70" cy="42" r="20" fill="#ffffff" />
      <rect x="10" y="42" width="80" height="24" rx="8" fill="#ffffff" />
      {/* Band, narrower than the puff so the silhouette reads as a hat */}
      <rect x="27" y="66" width="46" height="22" rx="7" fill="#ffffff" />
    </svg>
  );
}
