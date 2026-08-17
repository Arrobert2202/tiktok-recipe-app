import { Suspense } from "react";
import { SignInForm } from "@/components/signin-form";

/**
 * Static shell rendered while the client sign-in form loads.
 * Mirrors the form's box sizes so there is no layout shift on swap.
 */
function SignInSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px]" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-pink-500/10 blur-[100px]" />

      <div className="relative w-full max-w-sm" aria-hidden="true">
        <div className="text-center mb-10">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-white/5 mb-4" />
          <div className="h-9 w-3/4 mx-auto rounded-lg bg-white/5 mb-2" />
          <div className="h-5 w-1/2 mx-auto rounded-lg bg-white/5" />
        </div>

        <div className="h-14 w-full rounded-2xl bg-white/10" />

        <div className="mt-8 space-y-1.5">
          <div className="h-3 w-2/3 mx-auto rounded bg-white/5" />
          <div className="h-3 w-3/4 mx-auto rounded bg-white/5" />
        </div>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInSkeleton />}>
      <SignInForm />
    </Suspense>
  );
}
