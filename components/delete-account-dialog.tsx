"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { deleteAccount } from "@/actions/account";
import { authClient } from "@/lib/auth-client";

/** The word the user has to type out before the confirm button unlocks. */
const CONFIRM_PHRASE = "DELETE";

const REMOVED = [
  "Your profile: email, name, and avatar",
  "Your cookbook and every recipe saved in it",
  "Your tags and cookbook organisation",
  "Your extraction history and remaining credits",
];

const KEPT = [
  "Recipes you extracted stay available to other users. They aren't owned by any one account — they're shared, cached content.",
];

export function DeleteAccountDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canConfirm = confirmText === CONFIRM_PHRASE && !isDeleting;

  function openDialog() {
    setConfirmText("");
    setError(null);
    setIsOpen(true);
  }

  function closeDialog() {
    if (isDeleting) return; // don't yank the modal out from under an in-flight delete
    setIsOpen(false);
    setConfirmText("");
    setError(null);
  }

  async function handleDelete() {
    if (!canConfirm) return;

    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteAccount();

      if ("error" in result) {
        // Modal stays open so the user can read the reason and retry.
        setError(result.error.message);
        setIsDeleting(false);
        return;
      }

      // The session rows are already gone via cascade, but the session cookie is
      // still sitting in the browser pointing at a user that no longer exists.
      // Clear it before navigating, otherwise the next request arrives holding a
      // token for a deleted account.
      //
      // The account is already gone at this point, so a failure here must not be
      // reported as a failed deletion — the user would retry a delete that has
      // nothing left to remove. Worst case the cookie lingers and resolves to no
      // session, which the app already treats as signed out.
      try {
        await authClient.signOut();
      } catch (signOutError) {
        console.error("[deleteAccount] sign-out after deletion failed:", signOutError);
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while deleting your account. Please try again."
      );
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200 hover:border-red-500/50 transition-all active:scale-[0.98]"
      >
        <Trash2 className="w-4 h-4" />
        Delete my account
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={closeDialog}
          >
            {/* Backdrop with blur */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#12121f] shadow-2xl"
            >
              {/* Ambient glow effect */}
              <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-red-500/20 blur-[80px]" />
              <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-red-500/10 blur-[80px]" />

              {/* Close button */}
              <button
                onClick={closeDialog}
                disabled={isDeleting}
                className="absolute top-4 right-4 z-10 rounded-full bg-white/5 p-2 text-white/50 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="relative px-8 pt-10 pb-8">
                {/* Icon */}
                <div className="flex justify-center mb-6">
                  <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                </div>

                <h2
                  id="delete-account-title"
                  className="text-2xl font-bold text-center text-white mb-2"
                >
                  Delete your account?
                </h2>
                <p className="text-center text-white/50 mb-6">
                  This is permanent. It cannot be undone, and we cannot restore a
                  deleted account.
                </p>

                {/* What goes */}
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 mb-4">
                  <p className="text-sm font-semibold text-white mb-3">
                    Deleted for good
                  </p>
                  <ul className="space-y-2">
                    {REMOVED.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400"
                        />
                        <span className="text-sm text-white/70 leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* What stays */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 mb-6">
                  <p className="text-sm font-semibold text-white mb-3">
                    What stays
                  </p>
                  <ul className="space-y-2">
                    {KEPT.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/40"
                        />
                        <span className="text-sm text-white/70 leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Typed confirmation */}
                <label
                  htmlFor="delete-confirm-input"
                  className="block text-sm text-white/60 mb-2"
                >
                  Type{" "}
                  <span className="font-mono font-semibold text-white">
                    {CONFIRM_PHRASE}
                  </span>{" "}
                  to confirm
                </label>
                <input
                  id="delete-confirm-input"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isDeleting}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={CONFIRM_PHRASE}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 font-mono text-white placeholder:text-white/20 focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
                />

                {error && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                  >
                    {error}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    onClick={closeDialog}
                    disabled={isDeleting}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3.5 px-6 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Keep my account
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!canConfirm}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 px-6 text-sm font-semibold text-white shadow-lg shadow-red-500/20 hover:bg-red-700 transition-all active:scale-[0.98] disabled:bg-red-600/30 disabled:text-white/40 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete permanently
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
