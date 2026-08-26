import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserCredits } from "@/lib/credits";
import { SettingsPageContent } from "@/components/settings-page-content";
import { getServerLanguage, translateForMetadata } from "@/lib/get-server-language";

export async function generateMetadata(): Promise<Metadata> {
  const language = await getServerLanguage();

  return {
    title: translateForMetadata("settings.heading", language),
    description: translateForMetadata("metadata.settings.description", language),
    robots: { index: false, follow: false },
  };
}

export default async function SettingsPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/auth/signin?callbackUrl=/settings");
  }

  const credits = await getUserCredits(session.user.id);

  return (
    <SettingsPageContent
      email={session.user.email}
      name={session.user.name}
      credits={credits}
    />
  );
}
