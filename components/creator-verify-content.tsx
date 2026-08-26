"use client";

import { CreatorConfirmButton } from "@/components/creator-confirm-button";
import { useLanguage } from "@/lib/use-language";

interface Pending {
  handle: string;
  pendingAction: "opt_out" | "reverse" | null;
}

interface CreatorVerifyContentProps {
  pending: Pending | null;
  token: string | undefined;
}

export function CreatorVerifyContent({ pending, token }: CreatorVerifyContentProps) {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-lg px-6 py-24">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center">
          {pending && token && pending.pendingAction ? (
            <>
              <h1 className="text-xl font-semibold text-white mb-2">
                {pending.pendingAction === "opt_out"
                  ? t("creators.verify.confirmOptOut")
                  : t("creators.verify.confirmReversal")}
              </h1>
              <p className="text-sm text-white/60 mb-6">
                {pending.pendingAction === "opt_out"
                  ? t("creators.verify.confirmOptOutBody", { handle: pending.handle })
                  : t("creators.verify.confirmReversalBody", { handle: pending.handle })}
              </p>
              <CreatorConfirmButton
                token={token}
                handle={pending.handle}
                action={pending.pendingAction}
              />
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-white mb-2">
                {t("creators.verify.linkInvalid")}
              </h1>
              <p className="text-sm text-white/60">
                {t("creators.verify.linkInvalidBody.prefix")}
                <a
                  href="/creators"
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {t("creators.verify.linkInvalidBody.linkText")}
                </a>
                {t("creators.verify.linkInvalidBody.suffix")}
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
