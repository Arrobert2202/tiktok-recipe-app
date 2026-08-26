import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ServiceWorkerRegistrar } from "@/components/sw-register";
import { LanguageProvider } from "@/lib/use-language";
import { getServerLanguage, translateForMetadata } from "@/lib/get-server-language";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage();
  const description = translateForMetadata("metadata.root.description", language);

  return {
    metadataBase: new URL(appUrl),
    title: "RecipeApp",
    description,
    openGraph: {
      type: "website",
      siteName: "RecipeApp",
      title: "RecipeApp",
      description,
      url: appUrl,
    },
    robots: { index: true, follow: true },
    // Emits the apple-mobile-web-app-* meta tags iOS reads when a page is added
    // to the home screen. `capable` is apple-mobile-web-app-capable.
    appleWebApp: {
      capable: true,
      title: "RecipeApp",
      statusBarStyle: "black-translucent",
    },
  };
}

// Next 16 rejects `themeColor` inside `metadata` — it belongs to the separate
// `viewport` export.
export const viewport: Viewport = {
  themeColor: "#0a0a0f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getServerLanguage();

  return (
    <html lang={language} className={inter.className}>
      <body className="antialiased relative">
        {/* Ambient background glow orbs */}
        <div className="ambient-glow ambient-glow-1" aria-hidden="true" />
        <div className="ambient-glow ambient-glow-2" aria-hidden="true" />
        <div className="ambient-glow ambient-glow-3" aria-hidden="true" />

        <LanguageProvider>
          <div className="relative z-10">
            <Navbar />
            {children}
            <Footer />
          </div>
        </LanguageProvider>

        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
