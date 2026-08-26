"use client";

import { useState } from "react";
import { submitOptOutRequest, reverseOptOut } from "@/actions/creator";
import { validateTikTokHandle } from "@/lib/validation";
import { useLanguage } from "@/lib/use-language";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function CreatorPortalPage() {
  const { t } = useLanguage();
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
      setHandleError(t("creators.handleValidationError"));
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
      setHandleError(t("creators.handleValidationError"));
      return;
    }
    setFormState({ status: "submitting" });

    const result = await submitOptOutRequest(handle, email);
    if (result.success) {
      setFormState({
        status: "success",
        message: t("creators.optOutSuccessMessage"),
      });
      setHandle("");
      setEmail("");
    } else {
      setFormState({ status: "error", message: result.error ?? t("creators.genericError") });
    }
  }

  async function handleReverse(e: React.FormEvent) {
    e.preventDefault();
    if (!validateTikTokHandle(handle)) {
      setHandleError(t("creators.handleValidationError"));
      return;
    }
    setFormState({ status: "submitting" });

    const result = await reverseOptOut(handle, email);
    if (result.success) {
      setFormState({
        status: "success",
        message: t("creators.reverseSuccessMessage"),
      });
      setHandle("");
      setEmail("");
    } else {
      setFormState({ status: "error", message: result.error ?? t("creators.genericError") });
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
            {t("creators.hero.heading")}
          </h1>
          <p className="mt-4 text-lg text-white/60">{t("creators.hero.body")}</p>
        </div>
      </section>

      {/* Info Section */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            {t("creators.whatHappens.heading")}
          </h2>
          <ul className="space-y-3 text-white/70">
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                1
              </span>
              <span>{t("creators.whatHappens.step1")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                2
              </span>
              <span>{t("creators.whatHappens.step2")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                3
              </span>
              <span>{t("creators.whatHappens.step3")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                4
              </span>
              <span>{t("creators.whatHappens.step4")}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-medium text-white">
                5
              </span>
              <span>{t("creators.whatHappens.step5")}</span>
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
            {t("creators.tab.optOut")}
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
            {t("creators.tab.reverse")}
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
                {t("creators.requestSubmitted")}
              </p>
              <p className="mt-2 text-white/60">{formState.message}</p>
              <button
                type="button"
                onClick={resetForm}
                className="mt-6 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/15 transition-colors"
              >
                {t("creators.submitAnother")}
              </button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-medium text-white mb-1">
                {activeTab === "opt-out"
                  ? t("creators.form.optOutHeading")
                  : t("creators.form.reverseHeading")}
              </h3>
              <p className="text-sm text-white/50 mb-6">
                {activeTab === "opt-out"
                  ? t("creators.form.optOutSubhead")
                  : t("creators.form.reverseSubhead")}
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
                    {t("creators.form.handleLabel")}
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
                      placeholder={t("creators.form.handlePlaceholder")}
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
                    {t("creators.form.emailLabel")}
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                    placeholder={t("creators.form.emailPlaceholder")}
                    disabled={formState.status === "submitting"}
                  />
                  <p className="mt-1 text-xs text-white/40">
                    {t("creators.form.emailHint")}
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
                    ? t("creators.form.submitting")
                    : activeTab === "opt-out"
                      ? t("creators.form.submitOptOut")
                      : t("creators.tab.reverse")}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Support Section */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            {t("creators.support.heading")}
          </h2>
          <p className="text-sm text-white/60">
            {t("creators.support.body.prefix")}
            <a
              href="mailto:robertaron993@gmail.com"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              robertaron993@gmail.com
            </a>
            {t("creators.support.body.suffix")}
          </p>
        </div>
      </section>
    </main>
  );
}
