"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Wand2, LogOut, ChefHat, ShoppingCart, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useLanguage, SUPPORTED_LANGUAGES } from "@/lib/use-language";
import { CreditCounter } from "@/components/credit-counter";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const { language, setLanguage, t } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Don't show navbar on auth pages
  if (pathname.startsWith("/auth")) {
    return null;
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/auth/signin");
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === language);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/50 border-b border-white/5">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2 group">
          <ChefHat className="w-6 h-6 text-purple-400 group-hover:text-purple-300 transition-colors" />
          <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            RecipeApp
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {isPending ? (
            <div className="h-9" />
          ) : session ? (
            <>
              <Link
                href="/"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  pathname === "/"
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Wand2 className="w-4 h-4" />
                {t("nav.extract")}
              </Link>
              <Link
                href="/cookbook"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  pathname === "/cookbook"
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                {t("nav.cookbook")}
              </Link>
              <Link
                href="/shopping-list"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  pathname === "/shopping-list"
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {t("nav.shopping")}
              </Link>
              <Link
                href="/settings"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  pathname === "/settings"
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Settings className="w-4 h-4" />
                {t("nav.settings")}
              </Link>

              {/* Credit Counter */}
              <CreditCounter />
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-white/60 hover:text-white transition-colors px-4 py-2"
              >
                {t("nav.signIn")}
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white hover:from-purple-700 hover:to-pink-600 transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 active:scale-95"
              >
                {t("nav.signUp")}
              </Link>
            </>
          )}

          {/* Language Selector — controls the language new extractions come
              back in. Independent of sign-in state (localStorage-backed), so
              it renders here regardless of session, including for anonymous
              landing-page visitors whose extractions already honor it. */}
          {!isPending && (
            <div className="relative ml-2" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white/80 hover:bg-white/10 hover:border-white/20 transition-all"
                aria-label={t("nav.selectRecipeLanguage")}
              >
                <span>{currentLang?.flag}</span>
                <span className="uppercase text-xs font-medium">{language}</span>
              </button>

              {langOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl py-2 z-50 max-h-80 overflow-y-auto">
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setLangOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors hover:bg-white/5 ${
                        lang.code === language ? "text-purple-400" : "text-white/70"
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {session && (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-all ml-2"
            >
              <LogOut className="w-4 h-4" />
              {t("nav.signOut")}
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
