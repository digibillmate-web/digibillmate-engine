import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Triggers a Cloudflare Pages deploy.
 *
 * The hook URL is a capability: anyone holding it can trigger builds, so it
 * lives in server-only env and never reaches the browser. The browser asks
 * this route to publish; the route decides whether to.
 *
 * Deploy hooks are fire-and-forget. Cloudflare's response confirms only that
 * the trigger was *accepted* and queued — not that the build ran, succeeded,
 * or went live. This route reports exactly that and no more.
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

  const hookUrl = process.env.CLOUDFLARE_DEPLOY_HOOK_URL;

  if (!hookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'CLOUDFLARE_DEPLOY_HOOK_URL is not set. Add it to admin-tool/.env.local (server-side only).',
      },
      { status: 503 },
    );
  }

  // A deploy hook carries no site parameter — it rebuilds one fixed Pages
  // project, which builds whatever *its* SITE_ID env var points at. Publishing
  // a different site through this hook would rebuild the wrong site while
  // reporting success, so refuse rather than mislead.
  const hookSiteId = process.env.CLOUDFLARE_DEPLOY_HOOK_SITE_ID;

  if (hookSiteId && hookSiteId !== siteId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'This deploy hook builds a different site. Each Pages project needs its own hook, ' +
          'since a hook cannot be told which site to build.',
      },
      { status: 409 },
    );
  }

  let response: Response;
  try {
    response = await fetch(hookUrl, { method: 'POST' });
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
    unscoped: !hookSiteId,
  });
}
