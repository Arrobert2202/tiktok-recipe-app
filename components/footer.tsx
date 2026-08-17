import Link from "next/link";

const LINKS = [
  { href: "/install", label: "Install app" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/creators", label: "Creators" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-24">
      <div className="mx-auto max-w-5xl px-6 py-12 text-center">
        <nav
          aria-label="Footer"
          className="flex items-center justify-center gap-6"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-4 text-xs text-white/30">
          Recipes belong to their original creators.
        </p>
      </div>
    </footer>
  );
}
