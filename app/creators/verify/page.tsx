import { db } from "@/db";
import { creatorOptOuts } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { CreatorConfirmButton } from "@/components/creator-confirm-button";
import type { Metadata } from "next";

// A token sits in this page's URL until it's claimed — no outbound links
// should carry it along in a Referer header.
export const metadata: Metadata = {
  referrer: "no-referrer",
};

interface VerifyPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function CreatorVerifyPage({ searchParams }: VerifyPageProps) {
  const { token } = await searchParams;

  // Read-only lookup, just to know what to show — this does not consume the
  // token. The actual claim (and the mutation it gates) only happens when
  // CreatorConfirmButton's click handler runs confirmCreatorAction, so an
  // email client or scanner GETing this page can't burn the link on its own.
  const [pending] = token
    ? await db
        .select({ handle: creatorOptOuts.handle, pendingAction: creatorOptOuts.pendingAction })
        .from(creatorOptOuts)
        .where(
          and(eq(creatorOptOuts.pendingToken, token), gt(creatorOptOuts.pendingTokenExpiresAt, new Date()))
        )
    : [];

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-lg px-6 py-24">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center">
          {pending && token && pending.pendingAction ? (
            <>
              <h1 className="text-xl font-semibold text-white mb-2">
                {pending.pendingAction === "opt_out" ? "Confirm Opt-Out" : "Confirm Reversal"}
              </h1>
              <p className="text-sm text-white/60 mb-6">
                {pending.pendingAction === "opt_out"
                  ? `This confirms that @${pending.handle} should stop appearing in recipe extraction results.`
                  : `This confirms that @${pending.handle}'s opt-out should be reversed.`}
              </p>
              <CreatorConfirmButton
                token={token}
                handle={pending.handle}
                action={pending.pendingAction as "opt_out" | "reverse"}
              />
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white mb-2">Link Invalid or Expired</h1>
              <p className="text-sm text-white/60">
                This confirmation link is no longer valid — it may have already been used, or it's
                older than 7 days. Submit a new request from the{" "}
                <a href="/creators" className="text-purple-400 hover:text-purple-300 transition-colors">
                  creator portal
                </a>
                .
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
