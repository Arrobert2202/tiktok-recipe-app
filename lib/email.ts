import { Resend } from "resend";

/**
 * Sender address for creator-portal confirmation emails. Actually delivering
 * mail from it requires the domain to be verified in Resend — until that's
 * done, point this at Resend's shared testing domain (onboarding@resend.dev)
 * via the env var, since a from-address on an unverified domain fails to
 * send rather than falling back to anything.
 */
const FROM_ADDRESS = process.env.CREATOR_EMAIL_FROM || "creators@tiktokrecipe.app";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Creator opt-out/reversal emails cannot be sent without it."
    );
  }
  return new Resend(apiKey);
}

/**
 * Sends the confirmation link a creator must click to actually opt out or
 * reverse an opt-out. Also logs the URL to the console regardless of
 * whether the send succeeds, so local development without a real Resend
 * key can still click through the flow manually.
 */
export async function sendCreatorVerificationEmail(params: {
  to: string;
  handle: string;
  action: "opt_out" | "reverse";
  verifyUrl: string;
}): Promise<void> {
  const { to, handle, action, verifyUrl } = params;

  console.log(`[creator-verification] ${action} link for @${handle}: ${verifyUrl}`);

  const subject =
    action === "opt_out"
      ? `Confirm your opt-out request for @${handle}`
      : `Confirm reversing your opt-out for @${handle}`;

  const bodyText =
    action === "opt_out"
      ? `Someone requested that @${handle}'s TikTok videos be excluded from recipe extraction on RecipeApp.\n\nIf this was you, confirm the request:\n${verifyUrl}\n\nIf you didn't request this, you can ignore this email — nothing happens until the link above is clicked.\n\nThis link expires in 7 days.`
      : `Someone requested that @${handle}'s prior opt-out be reversed, restoring public recipe extraction on RecipeApp.\n\nIf this was you, confirm the request:\n${verifyUrl}\n\nIf you didn't request this, you can ignore this email — nothing happens until the link above is clicked.\n\nThis link expires in 7 days.`;

  const bodyHtml = `<p>${bodyText.split("\n\n").join("</p><p>").replace(/\n/g, "<br>")}</p>`;

  await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    text: bodyText,
    html: bodyHtml,
  });
}
