import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { getUserCredits } from "@/lib/credits";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your account details, credit balance, and account deletion.",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/auth/signin?callbackUrl=/settings");
  }

  const credits = await getUserCredits(session.user.id);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/50">
          Your account details and data controls.
        </p>

        {/* ─── Account ─── */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-5">Account</h2>

          <dl className="space-y-5">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-white/40">
                Email
              </dt>
              <dd className="mt-1 text-white/90 break-all">
                {session.user.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-white/40">
                Name
              </dt>
              <dd className="mt-1 text-white/90">
                {session.user.name || (
                  <span className="text-white/40">Not set</span>
                )}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-xs text-white/40">
            Your email and name come from your Google sign-in and can&apos;t be
            edited here.
          </p>
        </section>

        {/* ─── Credits ─── */}
        <section className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Credits</h2>
          <div className="flex items-baseline gap-2">
            <Sparkles className="w-5 h-5 self-center text-purple-400" />
            <span className="text-3xl font-bold text-white">{credits}</span>
            <span className="text-white/50">
              {credits === 1 ? "extraction left" : "extractions left"}
            </span>
          </div>
          <p className="mt-3 text-sm text-white/50">
            Each new recipe extraction uses one credit. Cached recipes are free.
          </p>
        </section>

        {/* ─── Danger zone ─── */}
        <section className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-white mb-2">Danger zone</h2>
          <p className="text-sm text-white/70 leading-relaxed">
            Deleting your account permanently removes your profile, your
            cookbook, your tags, and your extraction history. Recipes you
            extracted stay available to other users, since they aren&apos;t owned
            by any one account. This cannot be undone, so export anything you
            want to keep first.
          </p>

          <div className="mt-5">
            <DeleteAccountDialog />
          </div>

          <p className="mt-5 text-xs text-white/40">
            See our{" "}
            <Link
              href="/privacy"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Privacy Policy
            </Link>{" "}
            for what we hold and how long we keep it.
          </p>
        </section>
      </div>
    </main>
  );
}
