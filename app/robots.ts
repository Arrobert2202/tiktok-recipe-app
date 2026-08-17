import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/r/", "/creators", "/terms", "/privacy"],
        // Private, per-user, or non-content routes stay out of the index.
        disallow: [
          "/api/",
          "/cookbook",
          "/recipe/",
          "/shopping-list",
          "/settings",
          "/auth/",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
