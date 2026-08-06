/**
 * Transactional email, behind a one-function interface.
 *
 * Brevo is the provider. The interface exists because the provider is the part
 * most likely to change — a plan limit, a deliverability problem, a decision to
 * consolidate with whatever HRM uses — and none of that should reach the route
 * that calls it.
 *
 * REST over SMTP deliberately: Workers have no usable SMTP transport, so
 * Nodemailer and friends cannot run here regardless of configuration.
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text. Callers build this; nothing here parses or renders markup. */
  text: string;
  replyTo?: string;
}

export type MailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; skipped?: boolean };

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export async function sendMail(message: MailMessage): Promise<MailResult> {
  /*
   * BREVO_API_KEYS, plural, matching the secret already stored in Cloudflare.
   * Cloudflare never shows a secret's value again once set, so renaming it
   * would mean re-entering a key nobody can read back — the code moves to the
   * name instead. Singular is still accepted so a future rename is a rename,
   * not an outage.
   */
  const key = process.env.BREVO_API_KEYS ?? process.env.BREVO_API_KEY;
  const from = process.env.MAIL_FROM;

  /*
   * Missing configuration is "skipped", not "failed". An unconfigured site
   * should still capture enquiries; reporting that as a failure would put
   * every row into a retry queue for a problem retrying cannot fix.
   */
  if (!key || !from) {
    return {
      ok: false,
      skipped: true,
      error: 'Mail is not configured (BREVO_API_KEYS / MAIL_FROM).',
    };
  }

  let response: Response;
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: 'POST',
      headers: {
        'api-key': key,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: from, name: process.env.MAIL_FROM_NAME || 'DigiBillMate' },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        // So a reply goes to the customer rather than to the sending domain.
        ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return {
      ok: false,
      error: `Could not reach Brevo: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (!response.ok) {
    // Brevo returns a JSON body with a message; keep enough to diagnose.
    const detail = await response.text().catch(() => '');
    return { ok: false, error: `Brevo returned HTTP ${response.status}. ${detail.slice(0, 300)}` };
  }

  const payload = (await response.json().catch(() => null)) as { messageId?: string } | null;
  return { ok: true, id: payload?.messageId ?? null };
}
