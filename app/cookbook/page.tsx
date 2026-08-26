import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserCookbook } from "@/lib/cookbook-queries";
import { CookbookGrid } from "@/components/cookbook-grid";
import { CookbookHeader } from "@/components/cookbook-header";

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
        <CookbookHeader count={entries.length} />

        <CookbookGrid initialEntries={entries} />
      </div>
    </main>
  );
}
