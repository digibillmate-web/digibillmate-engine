import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendMail } from '@/lib/mailer';

/**
 * Enquiry intake for every built site.
 *
 * One endpoint, not a function per site. Each client site is its own Pages
 * project, so a per-site function would mean copying the mail key into every
 * one of them and remembering to do it again for each new client. Here a new
 * site needs no mail setup at all — it posts its own id and this route looks
 * the rest up.
 *
 * The row is written before the email is attempted. An enquiry that is stored
 * but not emailed is a delivery problem; an enquiry that is emailed but not
 * stored is gone the moment someone deletes the message.
 */

export const dynamic = 'force-dynamic';

/** Enough for a real enquiry, short enough that nobody can post a novel. */
const LIMITS = { name: 120, mobile: 40, email: 160, service: 120, message: 4000 };

/** Submissions from one address within the window before it is refused. */
const RATE_LIMIT = { max: 5, windowMinutes: 10 };

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/**
 * Origins allowed to post for a given site.
 *
 * Deliberately not derived from sites.subdomain. That column is the site's
 * name in this system, not its Pages project: this site's subdomain is
 * "digibillmate" while it is served from dbmcars.pages.dev. Deriving the
 * origin from it would 403 every genuine submission, and the failure would
 * look like a broken form rather than a mismatched setting.
 *
 * So: any Pages deploy, plus the site's own custom domain, plus local dev.
 *
 * That is wider than it first appears it should be, and it is worth being
 * clear why it is acceptable. CORS is not the security boundary here — the
 * browser enforces it, and anything posting directly ignores it entirely.
 * What actually protects this endpoint is that it writes only for a known
 * site id, drops honeypot hits, and rate-limits per address. The origin check
 * is hygiene on top of that, not the thing holding the door.
 */
function originAllowed(origin: string | null, customDomain: string | null): boolean {
  if (!origin) return false;

  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host === 'pages.dev' || host.endsWith('.pages.dev')) return true;

  if (customDomain) {
    const bare = customDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (host === bare || host === `www.${bare}`) return true;
  }

  return false;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function OPTIONS(request: Request) {
  // Answered before the site is known, so this only advertises the method set.
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body.' }, { status: 400 });
  }

  const siteId = clean(body.siteId, 64);
  if (!siteId) {
    return NextResponse.json({ ok: false, error: 'siteId is required.' }, { status: 400 });
  }

  /*
   * Honeypot: a field hidden from people and irresistible to bots. Answered
   * with success on purpose — telling a bot it was detected just teaches it to
   * try again without the field.
   */
  if (clean(body.website, 200)) {
    return NextResponse.json({ ok: true, stored: false }, { headers: corsHeaders(origin) });
  }

  const supabase = createServiceClient();

  const { data: site } = await supabase
    .from('sites')
    .select(
      'id, name, subdomain, custom_domain, enquiry_email, enquiry_notify, enquiry_monthly_limit',
    )
    .eq('id', siteId)
    .single();

  if (!site) {
    return NextResponse.json({ ok: false, error: 'Unknown site.' }, { status: 404 });
  }

  if (!originAllowed(origin, site.custom_domain)) {
    return NextResponse.json(
      { ok: false, error: 'This origin may not submit enquiries for that site.' },
      { status: 403 },
    );
  }

  const name = clean(body.name, LIMITS.name);
  const mobile = clean(body.mobile, LIMITS.mobile);

  if (!name || !mobile) {
    return NextResponse.json(
      { ok: false, error: 'Name and mobile number are required.' },
      { status: 422, headers: corsHeaders(origin) },
    );
  }

  // Cloudflare sets this; the fallback keeps the rate limit honest in dev.
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';

  /*
   * Rate limit in the database rather than in memory: Workers are per-request
   * with no shared state, so an in-process counter would reset constantly and
   * enforce nothing.
   */
  if (ip !== 'unknown') {
    const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000).toISOString();
    const { count } = await supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('source_ip', ip)
      .gte('created_at', since);

    if ((count ?? 0) >= RATE_LIMIT.max) {
      return NextResponse.json(
        { ok: false, error: 'Too many enquiries from this connection. Try again shortly.' },
        { status: 429, headers: corsHeaders(origin) },
      );
    }
  }

  const enquiry = {
    site_id: site.id,
    name,
    mobile,
    email: clean(body.email, LIMITS.email) || null,
    service: clean(body.service, LIMITS.service) || null,
    message: clean(body.message, LIMITS.message) || null,
    source_ip: ip,
    user_agent: clean(request.headers.get('user-agent'), 300) || null,
  };

  const { data: stored, error: storeError } = await supabase
    .from('enquiries')
    .insert(enquiry)
    .select('id')
    .single();

  if (storeError || !stored) {
    return NextResponse.json(
      { ok: false, error: 'Could not record the enquiry. Please call us instead.' },
      { status: 500, headers: corsHeaders(origin) },
    );
  }

  /*
   * Whether to notify at all, before composing anything.
   *
   * The cap exists because one Brevo account serves every client site: a form
   * loop or a spam run on one site would otherwise burn the whole plan's
   * allowance and silence notifications for all the others. Reaching the cap
   * is recorded on the row, so it shows up as a number in the admin rather
   * than as email that quietly stopped arriving.
   *
   * Counted over the calendar month, matching how the sending plan is billed.
   */
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  let blocked: string | null = null;

  if (!site.enquiry_notify) {
    blocked = 'Notifications are switched off for this site.';
  } else if (!site.enquiry_email) {
    blocked = 'No enquiry_email set for this site.';
  } else if (site.enquiry_monthly_limit !== null) {
    const { count: sentThisMonth } = await supabase
      .from('enquiries')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', site.id)
      .eq('email_status', 'sent')
      .gte('created_at', monthStart.toISOString());

    if ((sentThisMonth ?? 0) >= site.enquiry_monthly_limit) {
      blocked =
        `Monthly email limit reached (${site.enquiry_monthly_limit}). ` +
        'The enquiry is recorded; raise the limit to resume notifications.';
    }
  }

  /*
   * Notification. Failure here is recorded against the row and reported as
   * success to the visitor: from their side the enquiry did arrive, and asking
   * them to submit again would produce a duplicate rather than a delivery.
   */
  const to = site.enquiry_email;
  const result = blocked
    ? ({ ok: false, skipped: true, error: blocked } as const)
    : to
    ? await sendMail({
        to,
        subject: `New enquiry — ${name}${enquiry.service ? ` (${enquiry.service})` : ''}`,
        replyTo: enquiry.email ?? undefined,
        text: [
          `Site: ${site.name}`,
          `Name: ${name}`,
          `Mobile: ${mobile}`,
          enquiry.email ? `Email: ${enquiry.email}` : null,
          enquiry.service ? `Service: ${enquiry.service}` : null,
          '',
          enquiry.message || '(no message)',
        ]
          .filter((line) => line !== null)
          .join('\n'),
      })
    : ({ ok: false, skipped: true, error: 'No enquiry_email set for this site.' } as const);

  await supabase
    .from('enquiries')
    .update({
      email_status: result.ok ? 'sent' : 'skipped' in result && result.skipped ? 'skipped' : 'failed',
      email_error: result.ok ? null : result.error,
    })
    .eq('id', stored.id);

  return NextResponse.json(
    { ok: true, stored: true, notified: result.ok },
    { headers: corsHeaders(origin) },
  );
}
