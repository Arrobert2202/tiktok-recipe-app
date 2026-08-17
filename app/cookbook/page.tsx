import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserCookbook } from "@/lib/cookbook-queries";
import { CookbookGrid } from "@/components/cookbook-grid";

export default async function CookbookPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/auth/signin?callbackUrl=/cookbook");
  }

  const entries = await getUserCookbook(session.user.id);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">My Cookbook</h1>
          <p className="mt-1 text-sm text-white/50">
            {entries.length} {entries.length === 1 ? "recipe" : "recipes"} saved
          </p>
        </div>

        <CookbookGrid initialEntries={entries} />
      </div>
    </main>
  );
}
