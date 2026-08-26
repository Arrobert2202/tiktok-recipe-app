import { db } from "@/db";
import { creatorOptOuts } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { CreatorVerifyContent } from "@/components/creator-verify-content";
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
    <CreatorVerifyContent
      pending={
        pending
          ? {
              handle: pending.handle,
              pendingAction: pending.pendingAction as "opt_out" | "reverse" | null,
            }
          : null
      }
      token={token}
    />
  );
}
