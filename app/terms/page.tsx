import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern your use of our TikTok recipe extraction service, including credits, subscriptions, creator rights, and AI accuracy limits.",
};

const LAST_UPDATED = "July 30, 2026";

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-sm text-white/40">Last updated: {LAST_UPDATED}</p>

      <p className="mt-8 text-white/70 leading-relaxed">
        These terms are an agreement between you and RecipeApp (&quot;we&quot;,
        &quot;us&quot;). They cover what you can expect from the service and
        what we expect from you. By creating an account or using the service,
        you agree to them. If you don&apos;t agree, please don&apos;t use the
        service.
      </p>

      {/* ─── AI accuracy disclaimer (prominent, near the top on purpose) ─── */}
      <section className="mt-10 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-3">
          Important: recipes are AI-generated
        </h2>
        <p className="text-white/80 leading-relaxed">
          Every recipe on this service is produced by an AI model reading a
          video caption and, in some cases, a machine transcription of the
          video&apos;s audio. AI models make mistakes. Ingredients can be
          missed, quantities can be wrong, cooking times and temperatures can be
          misread, and steps can be reordered or invented.
        </p>
        <p className="mt-3 text-white/80 leading-relaxed">
          <strong className="font-semibold text-white">
            You must verify every recipe against the original video before you
            cook or eat anything.
          </strong>{" "}
          This matters most for:
        </p>
        <ul className="mt-3 list-disc list-inside space-y-2 text-white/80">
          <li>
            <strong className="font-semibold text-white">Allergens.</strong> Do
            not rely on our ingredient list to determine whether a dish is safe
            for someone with a food allergy or intolerance.
          </li>
          <li>
            <strong className="font-semibold text-white">Food safety.</strong>{" "}
            Cooking temperatures and times for meat, poultry, seafood, eggs, and
            preserved foods must be confirmed against a trusted source.
          </li>
          <li>
            <strong className="font-semibold text-white">
              Dietary and medical needs.
            </strong>{" "}
            Nothing here is nutritional or medical advice.
          </li>
        </ul>
        <p className="mt-3 text-white/80 leading-relaxed">
          We link to the original video on every recipe so you can always check
          the source. Please use it.
        </p>
      </section>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        1. What the service does
      </h2>
      <p className="text-white/70 leading-relaxed">
        You paste a link to a publicly posted TikTok video. We fetch the
        video&apos;s caption through TikTok&apos;s official oEmbed API and, when
        the caption alone isn&apos;t enough, we transcribe the video&apos;s
        audio. We then use an AI model to turn that text into a structured
        recipe: a title, an ingredient list, and numbered steps. You can save
        recipes to a personal cookbook, tag them, and share them on a public
        recipe page.
      </p>
      <p className="mt-3 text-white/70 leading-relaxed">
        We are a discovery and formatting layer. We are not a video host, and we
        are not the author of the recipes we format.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        2. Eligibility
      </h2>
      <p className="text-white/70 leading-relaxed">
        You must be at least 13 years old to use the service. If you are in the
        European Economic Area or the United Kingdom, you must be at least 16.
        If you are under the age of majority where you live, you need a parent
        or guardian&apos;s permission. We do not knowingly allow accounts for
        anyone below these ages, and we will close accounts we believe belong to
        underage users.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        3. Your account
      </h2>
      <p className="text-white/70 leading-relaxed">
        Accounts are created by signing in with Google. We never see or store
        your Google password. You are responsible for everything that happens
        under your account, so keep your Google account secure and don&apos;t
        share access. If you think someone else is using your account, contact
        us and we&apos;ll help you shut it down.
      </p>
      <p className="mt-3 text-white/70 leading-relaxed">
        One person, one account. Creating multiple accounts to collect extra
        free credits is not allowed.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        4. Credits, plans, and billing
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            New accounts receive a small number of free credits. One credit
            covers one recipe extraction.
          </li>
          <li>
            Paid plans give you expanded access. Plan details and prices are
            shown at the point of purchase and are what govern your
            subscription.
          </li>
          <li>
            Payments are processed by Stripe. We never receive or store your
            card details. Stripe&apos;s terms apply to the payment itself.
          </li>
          <li>
            Subscriptions renew automatically each month until you cancel. You
            can cancel at any time and keep access until the end of the period
            you&apos;ve already paid for.
          </li>
          <li>
            We don&apos;t refund partial months. If you cancel mid-cycle, your
            plan simply runs to the end of that cycle and then stops.
          </li>
          <li>
            Prices can change. We&apos;ll tell you before a change affects your
            next renewal, and you can cancel if you don&apos;t want to continue.
          </li>
          <li>
            If a payment fails, we may pause your paid access until the payment
            goes through.
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        5. Fair use of &quot;unlimited&quot; plans
      </h2>
      <p className="text-white/70 leading-relaxed">
        Where a plan is described as &quot;unlimited&quot;, it means unlimited
        for normal personal cooking use. It is not a licence to run automated
        extraction at scale. Every extraction costs us real money in AI
        processing, so a plan priced for a home cook can&apos;t absorb the
        workload of a data pipeline.
      </p>
      <p className="mt-3 text-white/70 leading-relaxed">
        If your usage is dramatically outside normal patterns, we may slow down
        (throttle) your extractions, and we&apos;ll get in touch to talk about
        what you&apos;re doing. We&apos;d rather find an arrangement that works
        than cut you off. Suspension or termination is a last resort, reserved
        for usage that is abusive or that we can&apos;t reach you about.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        6. Content and attribution
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-white/70 leading-relaxed">
          Recipes on this service are derived from content that creators posted
          publicly on TikTok. Our position on that content is straightforward:
        </p>
        <ul className="mt-3 list-disc list-inside space-y-2 text-white/70">
          <li>
            <strong className="font-semibold text-white">
              We claim no ownership
            </strong>{" "}
            of a creator&apos;s recipe, video, or brand. The recipe belongs to
            the person who made it.
          </li>
          <li>
            <strong className="font-semibold text-white">
              We always show attribution.
            </strong>{" "}
            Every recipe page displays the creator&apos;s handle and links back
            to their original video and profile. We don&apos;t strip credit, and
            you may not remove it either.
          </li>
          <li>
            <strong className="font-semibold text-white">
              We don&apos;t host videos.
            </strong>{" "}
            Videos are embedded or linked from TikTok. Playback happens on
            TikTok&apos;s infrastructure, under TikTok&apos;s terms.
          </li>
          <li>
            The structured formatting, layout, and the service itself are ours.
            Your account and your saved cookbook are yours.
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        7. Creator rights and opt-out
      </h2>
      <p className="text-white/70 leading-relaxed">
        If you are a TikTok creator and you don&apos;t want your content
        extracted, you can opt out. Go to{" "}
        <Link
          href="/creators"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          the creator portal
        </Link>{" "}
        and submit your handle. No account or negotiation required.
      </p>
      <p className="mt-3 text-white/70 leading-relaxed">
        We commit to honouring opt-out requests{" "}
        <strong className="font-semibold text-white">within 24 hours</strong>.
        Once processed:
      </p>
      <ul className="mt-3 list-disc list-inside space-y-2 text-white/70">
        <li>
          Your existing recipes are removed from public share pages and from our
          sitemap.
        </li>
        <li>Future extraction of your content is blocked.</li>
        <li>
          Users who already saved one of your recipes keep it privately, with a
          visible notice that you&apos;ve opted out.
        </li>
      </ul>
      <p className="mt-3 text-white/70 leading-relaxed">
        You can reverse an opt-out at any time from the same page. If you
        believe a specific recipe misrepresents your work, tell us and we&apos;ll
        remove it.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        8. Acceptable use
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-white/70 leading-relaxed">
          Don&apos;t do any of the following:
        </p>
        <ul className="mt-3 list-disc list-inside space-y-2 text-white/70">
          <li>
            Run automated or bulk extraction, whether by script, bot, or
            queueing links at machine speed.
          </li>
          <li>
            Scrape, crawl, or systematically harvest our pages, or bypass rate
            limits and robots directives.
          </li>
          <li>
            Resell, redistribute, or republish the recipes our service produces
            as your own dataset or product.
          </li>
          <li>
            Circumvent credit limits, including by creating multiple accounts,
            sharing credentials, or tampering with client-side code.
          </li>
          <li>
            Extract content from creators who have opted out, or work around the
            opt-out list.
          </li>
          <li>
            Attempt to break, overload, probe, or reverse engineer the service,
            or access other users&apos; data.
          </li>
          <li>
            Use the service for anything unlawful, or to submit content that is
            harassing, hateful, or infringing.
          </li>
        </ul>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        9. Third-party services
      </h2>
      <p className="text-white/70 leading-relaxed">
        The service depends on independent companies that we don&apos;t control:
        TikTok (video captions and embeds), Google (sign-in), OpenAI (recipe
        extraction and audio transcription), Stripe (payments), and our hosting
        and infrastructure providers. Each has its own terms and privacy policy,
        and those apply to you when your use of our service touches them. If one
        of them changes or breaks, parts of our service may change or break too.
        We&apos;ll do our best, but we can&apos;t promise otherwise.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        10. Termination
      </h2>
      <p className="text-white/70 leading-relaxed">
        You can stop using the service and delete your account whenever you
        like. Deleting your account removes your profile, your cookbook, and
        your tags.
      </p>
      <p className="mt-3 text-white/70 leading-relaxed">
        We can suspend or terminate an account that breaks these terms,
        particularly for abuse, fraud, or automated extraction. Where it is
        reasonable to do so, we&apos;ll warn you first and give you a chance to
        fix the problem. We may also discontinue the service as a whole; if we
        do, we&apos;ll give notice and refund any prepaid time you haven&apos;t
        used.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        11. Disclaimers and limitation of liability
      </h2>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-white/70 leading-relaxed">
          The service is provided &quot;as is&quot; and &quot;as
          available&quot;, without warranties of any kind, express or implied,
          including any implied warranties of merchantability, fitness for a
          particular purpose, accuracy, or non-infringement. We don&apos;t
          warrant that extractions will be correct or complete, or that the
          service will be uninterrupted or error-free.
        </p>
        <p className="mt-3 text-white/70 leading-relaxed">
          To the fullest extent permitted by law, we are not liable for
          indirect, incidental, special, consequential, or punitive damages, or
          for lost profits, lost data, or ruined meals. Our total liability for
          any claim relating to the service is limited to the amount you paid us
          in the 12 months before the claim arose.
        </p>
        <p className="mt-3 text-white/70 leading-relaxed">
          Some jurisdictions don&apos;t allow certain exclusions, so parts of
          this section may not apply to you. Nothing here limits liability that
          cannot be limited by law, such as for death or personal injury caused
          by negligence, or for fraud.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        12. Changes to these terms
      </h2>
      <p className="text-white/70 leading-relaxed">
        We may update these terms as the service evolves. The current version is
        always posted on this page with the &quot;Last updated&quot; date at the
        top. For material changes, we&apos;ll give notice, by email or in the
        app, before they take effect. Continuing to use the service after a
        change takes effect means you accept the updated terms.
      </p>

      <h2 className="text-xl font-semibold text-white mt-10 mb-3">
        13. Contact
      </h2>
      <p className="text-white/70 leading-relaxed">
        Questions about these terms? Email{" "}
        {/* TODO: Replace legal@tiktokrecipe.app with a real, monitored address before launch. Stripe review will check that this address works. */}
        <a
          href="mailto:legal@tiktokrecipe.app"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          legal@tiktokrecipe.app
        </a>
        . Creators can also use the{" "}
        <Link
          href="/creators"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          creator portal
        </Link>
        . For how we handle your data, see our{" "}
        <Link
          href="/privacy"
          className="text-purple-400 hover:text-purple-300 transition-colors"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
