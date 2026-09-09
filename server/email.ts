// Transactional email via Resend. Fails soft: if RESEND_API_KEY isn't set
// (or the send throws), we log a warning and return false instead of
// throwing — callers (e.g. wholesaleApplications.create) must not let a
// missing/broken email provider block saving data to the database.
import { Resend } from "resend";

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "Brighter Days Labs <onboarding@resend.dev>";

let client: Resend | null = null;
function getClient(): Resend | null {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  client = new Resend(apiKey);
  return client;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(input: { to: string; subject: string; html: string }): Promise<boolean> {
  const result = await sendEmailWithDetail(input);
  return result.ok;
}

/**
 * The same send, with whatever Resend said about it.
 *
 * sendEmail deliberately collapses everything to a boolean so a broken
 * provider can never block saving an order. That is right for callers and
 * useless for working out *why* nothing arrived, which is what this is for.
 */
export async function sendEmailWithDetail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: unknown; reason?: string }> {
  const resend = getClient();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipped email to ${input.to}: "${input.subject}"`);
    return { ok: false, reason: "RESEND_API_KEY is not set on this process" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    if (error) {
      console.warn(`[email] Resend rejected email to ${input.to}:`, error);
      return { ok: false, error, reason: "Resend rejected the message" };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.warn(`[email] Failed to send email to ${input.to}:`, err);
    return { ok: false, error: String(err), reason: "the request to Resend threw" };
  }
}
