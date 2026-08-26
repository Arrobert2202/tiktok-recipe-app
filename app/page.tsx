import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getServerLanguage, translateForMetadata } from "@/lib/get-server-language";
import HomePage from "@/components/home-page";
import LandingPage from "@/components/landing-page";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage();
  const title = translateForMetadata("metadata.home.title", language);
  const description = translateForMetadata("metadata.home.description", language);

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: "/" },
  };
}

/**
 * Static shell shown while the client hero loads. Mirrors the hero's boxes so
 * the swap doesn't shift layout.
 */
function HeroSkeleton() {
  return (
    <main className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center" aria-hidden="true">
        <div className="mx-auto mb-6 h-8 w-64 rounded-full bg-white/5" />
        <div className="mb-4 h-14 w-full rounded-2xl bg-white/5" />
        <div className="mx-auto mb-10 h-14 w-4/5 rounded-2xl bg-white/5" />
        <div className="mx-auto mb-12 h-5 w-2/3 rounded-lg bg-white/5" />
        <div className="h-20 w-full rounded-2xl bg-white/10" />
      </div>
    </main>
  );
}

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Both heroes read `?url=` with useSearchParams (the share-sheet entry
  // point), which requires a Suspense boundary or the production build fails
  // to prerender this route.
  return (
    <Suspense fallback={<HeroSkeleton />}>
      {session ? <HomePage /> : <LandingPage />}
    </Suspense>
  );
}
