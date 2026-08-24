"use client";

import { useState } from "react";
import { submitOptOutRequest, reverseOptOut } from "@/actions/creator";
import { validateTikTokHandle } from "@/lib/validation";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function CreatorPortalPage() {
  const [activeTab, setActiveTab] = useState<"opt-out" | "reverse">("opt-out");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [handleError, setHandleError] = useState("");
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  function validateHandle(value: string) {
    if (!value) {
      setHandleError("");
      return;
    }
    if (!validateTikTokHandle(value)) {
      setHandleError(
        "Handle must be 1-24 characters using only letters, numbers, and underscores."
      );
    } else {
      setHandleError("");
    }
  }

  function handleHandleChange(value: string) {
    setHandle(value);
    validateHandle(value);
  }

  async function handleOptOut(e: React.FormEvent) {
    e.preventDefault();
    if (!validateTikTokHandle(handle)) {
      setHandleError(
        "Handle must be 1-24 characters using only letters, numbers, and underscores."
      );
      return;
    }
    setFormState({ status: "submitting" });

    const result = await submitOptOutRequest(handle, email);
    if (result.success) {
      setFormState({
        status: "success",
        message:
          "Check your email for a confirmation link — the request doesn't take effect until you click it. Once you do, it takes effect immediately. The link expires in 7 days.",
      });
      setHandle("");
      setEmail("");
    } else {
      setFormState({ status: "error", message: result.error ?? "Something went wrong." });
    }
  }

  async function handleReverse(e: React.FormEvent) {
    e.preventDefault();
    if (!validateTikTokHandle(handle)) {
      setHandleError(
        "Handle must be 1-24 characters using only letters, numbers, and underscores."
      );
      return;
    }
    setFormState({ status: "submitting" });

    const result = await reverseOptOut(handle, email);
    if (result.success) {
      setFormState({
        status: "success",
        message:
          "If that handle has an active opt-out under this email, we've sent a confirmation link — the reversal doesn't take effect until you click it. The link expires in 7 days.",
      });
      setHandle("");
      setEmail("");
    } else {
      setFormState({ status: "error", message: result.error ?? "Something went wrong." });
    }
  }

  function resetForm() {
    setFormState({ status: "idle" });
    setHandle("");
    setEmail("");
    setHandleError("");
  }

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Creator Content Control
          </h1>
          <p className="mt-4 text-lg text-white/60">
            We respect your content and your choices. If you&apos;re a TikTok
            creator and would prefer that your videos are not indexed by our
            recipe extraction service, you can opt out here.
          </p>
        </div>
      </section>

      {/* Info Section */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            What happens when you opt out
          </h2>
          <ul className="space-y-3 text-white/70">
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                1
              </span>
              <span>
                We&apos;ll email you a confirmation link. Nothing changes until
                you click it — this proves the request actually came from you.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                2
              </span>
              <span>
                Once confirmed, new recipe extractions from your videos will be
                blocked. Users will see a notice that you&apos;ve opted out.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                3
              </span>
              <span>
                Existing recipes from your videos are removed from public
                share pages immediately, in the same step.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                4
              </span>
              <span>
                Users who previously saved your recipes will keep them in their
                private cookbooks, but with a visible notice that you&apos;ve
                opted out.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                5
              </span>
              <span>
                You can reverse your decision at any time (same email
                confirmation step), and public access will be restored within
                24 hours.
              </span>
            </li>
          </ul>
        </div>

        {/* Tab Navigation */}
        <div className="mt-8 flex border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              setActiveTab("opt-out");
              resetForm();
            }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "opt-out"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-white/50 hover:text-white/70 hover:border-white/20"
            }`}
          >
            Opt Out
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("reverse");
              resetForm();
            }}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "reverse"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-white/50 hover:text-white/70 hover:border-white/20"
            }`}
          >
            Reverse Opt-Out
          </button>
        </div>

        {/* Form */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          {formState.status === "success" ? (
            <div className="text-center py-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                <svg
                  className="h-6 w-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-white">
                Request Submitted
              </p>
              <p className="mt-2 text-white/60">{formState.message}</p>
              <button
                type="button"
                onClick={resetForm}
                className="mt-6 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/15 transition-colors"
              >
                Submit another request
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-medium text-white mb-1">
                {activeTab === "opt-out"
                  ? "Request Content Opt-Out"
                  : "Reverse Your Opt-Out"}
              </h3>
              <p className="text-sm text-white/50 mb-6">
                {activeTab === "opt-out"
                  ? "Enter your TikTok handle and email to opt out of recipe extraction."
                  : "Enter your TikTok handle and email to restore public access to your recipes."}
              </p>

              {formState.status === "error" && (
                <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm text-red-400">{formState.message}</p>
                </div>
              )}

              <form
                onSubmit={activeTab === "opt-out" ? handleOptOut : handleReverse}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="handle"
                    className="block text-sm font-medium text-white/70"
                  >
                    TikTok Handle
                  </label>
                  <div className="mt-1 flex rounded-xl border border-white/10 bg-white/5 focus-within:border-purple-500/50 focus-within:ring-1 focus-within:ring-purple-500/50">
                    <span className="flex items-center pl-3 text-white/40 text-sm">
                      @
                    </span>
                    <input
                      id="handle"
                      type="text"
                      required
                      value={handle}
                      onChange={(e) => handleHandleChange(e.target.value)}
                      className="block w-full rounded-r-xl border-0 bg-transparent px-2 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                      placeholder="your_handle"
                      disabled={formState.status === "submitting"}
                      aria-describedby={handleError ? "handle-error" : undefined}
                      aria-invalid={handleError ? "true" : undefined}
                    />
                  </div>
                  {handleError && (
                    <p id="handle-error" className="mt-1 text-xs text-red-400">
                      {handleError}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-white/70"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    placeholder="creator@example.com"
                    disabled={formState.status === "submitting"}
                  />
                  <p className="mt-1 text-xs text-white/40">
                    Used for verification purposes only.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={
                    formState.status === "submitting" || !!handleError
                  }
                  className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 ${
                    activeTab === "opt-out"
                      ? "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 shadow-red-500/25 focus:ring-red-500/50"
                      : "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-purple-500/25 focus:ring-purple-500/50"
                  }`}
                >
                  {formState.status === "submitting"
                    ? "Submitting..."
                    : activeTab === "opt-out"
                      ? "Submit Opt-Out Request"
                      : "Reverse Opt-Out"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Support Section */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            Questions or concerns?
          </h2>
          <p className="text-sm text-white/60">
            If you have questions about how your content is used or need
            assistance with the opt-out process, please reach out to us at{" "}
            <a
              href="mailto:robertaron993@gmail.com"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              robertaron993@gmail.com
            </a>
            . We typically respond within one business day.
          </p>
        </div>
      </section>
    </main>
  );
}
