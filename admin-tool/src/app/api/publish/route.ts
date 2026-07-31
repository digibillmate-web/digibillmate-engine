import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Triggers a Cloudflare Pages deploy for one site.
 *
 * The hook lives on the site row (sites.deploy_hook_url), not in an env var.
 * A deploy hook rebuilds one fixed Pages project and cannot be told which site
 * to build, so one hook per site is the only arrangement that stays correct as
 * sites are added — a single global hook would rebuild the wrong site while
 * reporting success.
 *
 * Deploy hooks are fire-and-forget. Cloudflare's response confirms only that
 * the trigger was accepted and queued — not that the build ran, succeeded, or
 * went live. This route reports exactly that and no more.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not signed in.' }, { status: 401 });
  }

  // Publishing is an admin action. Checked here as well as by RLS because
  // this route calls out to Cloudflare, which has no notion of our roles.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Publishing requires an admin account.' },
      { status: 403 },
    );
  }

  let siteId: string | undefined;
  try {
    const body = (await request.json()) as { siteId?: string };
    siteId = body.siteId;
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected a JSON body.' }, { status: 400 });
  }

  if (!siteId) {
    return NextResponse.json({ ok: false, error: 'siteId is required.' }, { status: 400 });
  }

  // The hook is read under the caller's own session, so RLS governs access to
  // it exactly as it governs the rest of the row.
  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name, subdomain, status, deploy_hook_url')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json(
      { ok: false, error: 'Site not found, or not visible to your account.' },
      { status: 404 },
    );
  }

  if (!site.deploy_hook_url) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `"${site.name}" has no deploy hook yet. Create its Cloudflare Pages project, then ` +
          'save the deploy hook on the site so it knows where to publish.',
      },
      { status: 409 },
    );
  }

  let response: Response;
  try {
    response = await fetch(site.deploy_hook_url, { method: 'POST' });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: `Could not reach Cloudflare: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 502 },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return NextResponse.json(
      {
        ok: false,
        error: `Cloudflare rejected the trigger (HTTP ${response.status}). ${detail.slice(0, 200)}`,
      },
      { status: 502 },
    );
  }

  // Cloudflare returns { result: { id }, success: true } for an accepted hook.
  const payload = (await response.json().catch(() => null)) as {
    result?: { id?: string };
  } | null;

  return NextResponse.json({
    ok: true,
    deployId: payload?.result?.id ?? null,
    triggeredAt: new Date().toISOString(),
    // Deliberately explicit: accepted !== built !== live.
    note: 'Deploy queued at Cloudflare. Build status is not reported back here.',
  });
}
