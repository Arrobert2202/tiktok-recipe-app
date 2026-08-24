import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What we collect, what we never collect, who processes your data, and how to access, export, or delete it.",
};

const LAST_UPDATED = "July 30, 2026";

const PROCESSORS: { name: string; receives: string; why: string }[] = [
  {
    name: "Neon",
    receives:
      "Your account record, saved recipes, tags, and credit balance (database hosting)",
    why: "Stores the data that makes your cookbook work",
  },
  {
    name: "OpenAI",
    receives:
      "Video caption text and, when needed, transient audio for transcription",
    why: "Turns video text into a structured recipe",
  },
  {
    name: "Google",
    receives: "Your sign-in request; returns your email, name, and avatar",
    why: "Authenticates you without us handling passwords",
  },
  {
    name: "Vercel",
    receives: "Request metadata such as IP address, user agent, and timestamps",
    why: "Hosts and serves the app; basic security and error logs",
  },
  {
    name: "Stripe",
    receives: "Your email and payment details, entered directly with Stripe",
    why: "Processes one-time credit-pack payments; we never see card numbers",
  },
  {
    name: "Trigger.dev",
    receives: "Extraction job records (the URL being processed, job status)",
    why: "Runs extractions as background jobs so the app stays responsive",
  },
  {
    name: "Resend",
    receives: "A creator's email address, when they submit the opt-out form",
    why: "Delivers the one-click confirmation link for creator opt-out/reversal requests",
  },
];

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-white/40">Last updated: {LAST_UPDATED}</p>

      <p className="mt-8 text-white/70 leading-relaxed">
        This policy explains what RecipeApp collects, why, who else touches it,
        and what control you have. We&apos;ve tried to write it in plain
        language. If something here is unclear, email us and we&apos;ll explain
        it properly.
      </p>

      {/* ─── Core privacy commitment (prominent) ─── */}
      <section className="mt-10 rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-3">
          We never sell your data
        </h2>
        <p className="text-white/80 leading-relaxed">
          We do not sell, rent, or trade your personal data. We do not share it
          with data brokers, advertisers, or ad networks. We run no advertising
          and no cross-site tracking. The only companies that receive your data
          are the service providers listed below, and they only receive what
          they need to keep the app running.
        </p>
      </section>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        What we collect
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            <strong className="font-semibold text-white">
              Account information from Google.
            </strong>{" "}
            When you sign in with Google we receive your email address, your
            name, and your avatar image URL. That&apos;s it.
          </li>
          <li>
            <strong className="font-semibold text-white">
              Recipes you extract and save.
            </strong>{" "}
            The TikTok link you submitted, the extracted title, ingredients,
            steps, and tips, plus the creator attribution details.
          </li>
          <li>
            <strong className="font-semibold text-white">Your tags</strong> and
            the organisation of your cookbook.
          </li>
          <li>
            <strong className="font-semibold text-white">
              Your credit balance
            </strong>{" "}
            and a record of credit-pack purchases, if you've made any.
          </li>
          <li>
            <strong className="font-semibold text-white">
              Basic technical logs.
            </strong>{" "}
            IP address, browser user agent, request timestamps, and error
            traces, kept so we can debug problems and detect abuse.
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        What we do not collect
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            <strong className="font-semibold text-white">
              No TikTok account access.
            </strong>{" "}
            We never ask you to log into TikTok, we hold no TikTok credentials or
            tokens for you, and we cannot see your private TikTok data. We only
            read publicly posted videos through TikTok&apos;s official oEmbed
            API.
          </li>
          <li>
            <strong className="font-semibold text-white">
              No posting permissions.
            </strong>{" "}
            We cannot post, comment, like, or follow on your behalf anywhere.
          </li>
          <li>
            <strong className="font-semibold text-white">
              No payment card details.
            </strong>{" "}
            Card numbers go straight to Stripe. They never reach our servers.
          </li>
          <li>
            <strong className="font-semibold text-white">
              No Google password.
            </strong>{" "}
            Authentication happens on Google&apos;s side.
          </li>
          <li>
            <strong className="font-semibold text-white">
              No sale of personal data. Ever.
            </strong>
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        How we handle audio
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-white/70 leading-relaxed">
          When a video&apos;s caption doesn&apos;t contain enough detail, we
          extract the audio track and send it for transcription. That audio is{" "}
          <strong className="font-semibold text-white">
            processed transiently and never retained
          </strong>
          . It exists only in memory or in temporary storage for the seconds it
          takes to transcribe, and is discarded immediately afterwards. We do not
          keep audio files, we do not archive them, and we do not use them for
          anything other than producing the transcript for that one extraction.
          The resulting text feeds the recipe extraction and then is no longer
          needed.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        How we use your data
      </h2>
      <ul className="list-disc list-inside space-y-2 text-white/70">
        <li>
          To provide the service: extract recipes, save them to your cookbook,
          show your tags, keep you signed in.
        </li>
        <li>
          To track and enforce credits so that free and paid access work
          correctly.
        </li>
        <li>
          To prevent abuse: rate limiting, detecting bulk extraction, and
          spotting duplicate accounts created to farm free credits.
        </li>
        <li>
          To process payments and manage subscriptions (through Stripe).
        </li>
        <li>
          To fix bugs and keep the service reliable, using error and access logs.
        </li>
        <li>
          To contact you about your account, billing, or material changes to our
          terms. We don&apos;t send marketing email you didn&apos;t ask for.
        </li>
      </ul>
      <p className="mt-3 text-white/70 leading-relaxed">
        If you are in the EEA or UK, our legal bases are: performance of a
        contract (running the service you signed up for), legitimate interests
        (security, abuse prevention, debugging), and legal obligation (tax and
        accounting records for payments).
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        Third-party processors
      </h2>
      <p className="text-white/70 leading-relaxed">
        We use a small number of service providers. Each one only receives what
        it needs.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-6">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Third-party processors, what data each receives, and why
          </caption>
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="pb-3 pr-4 font-semibold text-white">
                Provider
              </th>
              <th scope="col" className="pb-3 pr-4 font-semibold text-white">
                What it receives
              </th>
              <th scope="col" className="pb-3 font-semibold text-white">
                Why
              </th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((processor) => (
              <tr
                key={processor.name}
                className="border-b border-white/5 last:border-0 align-top"
              >
                <th
                  scope="row"
                  className="py-3 pr-4 font-medium text-white/90 whitespace-nowrap"
                >
                  {processor.name}
                </th>
                <td className="py-3 pr-4 text-white/70 leading-relaxed">
                  {processor.receives}
                </td>
                <td className="py-3 text-white/70 leading-relaxed">
                  {processor.why}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        AI processing
      </h2>
      <p className="text-white/70 leading-relaxed">
        Recipe extraction is done by OpenAI models. We send the video&apos;s
        caption text and, where transcription is used, the transcript, and we
        receive a structured recipe back. We do not send your name, email, or
        account identifiers along with it.
      </p>
      <p className="mt-3 text-white/70 leading-relaxed">
        OpenAI does not use data submitted through its API to train its models by
        default, and we have not opted into any such training. OpenAI retains API
        request data for a limited period for abuse monitoring, under its own
        policies.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        Cookies and local storage
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            <strong className="font-semibold text-white">
              One session cookie
            </strong>{" "}
            to keep you signed in. It is strictly necessary for the service to
            work; without it you would be logged out on every page load.
          </li>
          <li>
            <strong className="font-semibold text-white">localStorage</strong>{" "}
            in your own browser for interface preferences: your chosen recipe
            language, which ingredients you&apos;ve ticked off, and your shopping
            list state. This data stays on your device and is not sent to us.
          </li>
          <li>
            <strong className="font-semibold text-white">
              No advertising cookies, no analytics fingerprinting, and no
              cross-site tracking.
            </strong>{" "}
            We don&apos;t embed third-party ad or tracking pixels. TikTok video
            embeds are served by TikTok and may set their own cookies when a
            video loads.
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        Data retention
      </h2>
      <p className="text-white/70 leading-relaxed">
        We keep your account data and saved recipes until you delete your
        account. Delete the account and they go. Technical logs are kept for a
        short period for security and debugging, then rotated out. Payment
        records are retained as long as tax and accounting law requires, which is
        typically several years. Audio, as described above, is never retained at
        all.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        Your rights
      </h2>
      <p className="text-white/70 leading-relaxed">
        Wherever you live, you can ask us to do the following, and we will:
      </p>
      <ul className="mt-3 list-disc list-inside space-y-2 text-white/70">
        <li>
          <strong className="font-semibold text-white">Access</strong> a copy of
          the personal data we hold about you.
        </li>
        <li>
          <strong className="font-semibold text-white">Export</strong> your
          recipes and cookbook in a portable format.
        </li>
        <li>
          <strong className="font-semibold text-white">Correct</strong>{" "}
          inaccurate account details.
        </li>
        <li>
          <strong className="font-semibold text-white">Delete</strong> your
          account and the data attached to it.
        </li>
        <li>
          <strong className="font-semibold text-white">Object to</strong> or ask
          us to{" "}
          <strong className="font-semibold text-white">restrict</strong> certain
          processing.
        </li>
      </ul>
      <p className="mt-3 text-white/70 leading-relaxed">
        If you are in the EEA or UK, these are your rights under the GDPR,
        including the right to lodge a complaint with your local data protection
        authority. If you are a California resident, the CCPA/CPRA gives you the
        rights to know, delete, correct, and opt out of sale or sharing. We
        don&apos;t sell or share personal data, so there is nothing to opt out
        of, and we will never discriminate against you for exercising a right.
      </p>
      <p className="mt-3 text-white/70 leading-relaxed">
        To exercise any of these, email us at the address below from the email
        address on your account, or use the in-app account deletion path. We aim
        to respond within 30 days.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        Deleting your account
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-white/70 leading-relaxed">
          Deleting your account removes your profile (email, name, avatar), your
          cookbook, your tags, and your extraction history. Recipes you saved are
          removed from your cookbook. Deletion is permanent and we cannot restore
          a deleted account, so export anything you want to keep first.
        </p>
        <p className="mt-3 text-white/70 leading-relaxed">
          You can do this yourself at any time from{" "}
          <Link
            href="/settings"
            className="text-purple-400 hover:text-purple-300 transition-colors"
          >
            Settings
          </Link>
          , under &quot;Danger zone&quot;. It takes effect immediately.
        </p>
        <p className="mt-3 text-white/70 leading-relaxed">
          You can also email us and ask us to delete your account, and we will
          confirm once it is done.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        International transfers
      </h2>
      <p className="text-white/70 leading-relaxed">
        We and our providers operate primarily in the United States, so your data
        may be processed there and in other countries where our providers run
        infrastructure. Where data is transferred out of the EEA or UK, we rely
        on the appropriate safeguards our providers offer, such as Standard
        Contractual Clauses.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">Children</h2>
      <p className="text-white/70 leading-relaxed">
        The service is not directed at children under 13, and we do not knowingly
        collect personal data from them. If you believe a child has given us
        personal data, contact us and we will delete it. See the age rules in our{" "}
        <Link
          href="/terms"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          Terms of Service
        </Link>
        .
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        Changes to this policy
      </h2>
      <p className="text-white/70 leading-relaxed">
        If we change how we handle your data, we&apos;ll update this page and the
        &quot;Last updated&quot; date. Material changes get notice by email or in
        the app before they take effect.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">Contact</h2>
      <p className="text-white/70 leading-relaxed">
        For privacy questions or to exercise any of your rights, email{" "}
        {/* TODO: Replace privacy@tiktokrecipe.app with a real, monitored inbox before launch. GDPR/CCPA requests arrive here and carry response deadlines, so it must be watched by a human. Consider naming a data protection contact if EU volume grows. */}
        <a
          href="mailto:privacy@tiktokrecipe.app"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          privacy@tiktokrecipe.app
        </a>
        . Creators looking to remove their content can use the{" "}
        <Link
          href="/creators"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          creator portal
        </Link>
        .
      </p>
    </main>
  );
}
