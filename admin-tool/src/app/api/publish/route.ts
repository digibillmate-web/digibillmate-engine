import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { triggerDeployment } from '@/lib/cloudflare';

/**
 * Triggers a Cloudflare Pages deploy for one site.
 *
 * The hook lives in site_deploy_hooks, an admin-only table, not on the site
 * row and not in an env var. A deploy hook rebuilds one fixed Pages project
 * and cannot be told which site to build, so one hook per site is the only
 * arrangement that stays correct as sites are added — a single global hook
 * would rebuild the wrong site while reporting success.
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

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id, name, subdomain, status, pages_project')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return NextResponse.json(
      { ok: false, error: 'Site not found, or not visible to your account.' },
      { status: 404 },
    );
  }

  /*
   * Publishing means two things, and doing only the second is why a draft
   * could never go live from here: the build refuses anything not marked
   * published, but nothing in the portal could mark it. So the status is
   * moved first, then the deploy is triggered.
   */
  if (site.status !== 'published') {
    const { error: statusError } = await supabase
      .from('sites')
      .update({ status: 'published' })
      .eq('id', siteId);

    if (statusError) {
      return NextResponse.json(
        { ok: false, error: `Could not mark the site published: ${statusError.message}` },
        { status: 500 },
      );
    }
  }

  /*
   * A provisioned site deploys through the API, using the project name it
   * already knows. Deploy hooks predate that: they had to be created by hand,
   * copied, and stored, and each could only ever build the one project it was
   * made for. The hook path stays for sites provisioned before this existed.
   */
  if (site.pages_project) {
    const deployment = await triggerDeployment(site.pages_project);

    if (!deployment.ok) {
      return NextResponse.json(
        { ok: false, error: `Cloudflare rejected the deploy: ${deployment.error}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      deployId: deployment.data?.id ?? null,
      triggeredAt: new Date().toISOString(),
      note: 'Deploy queued at Cloudflare. Build status is not reported back here.',
    });
  }

  // Read under the caller's own session: site_deploy_hooks has an admin-only
  // policy, so a non-admin gets no row rather than a hook they should not see.
  const { data: hook } = await supabase
    .from('site_deploy_hooks')
    .select('url')
    .eq('site_id', siteId)
    .maybeSingle();

  if (!hook?.url) {
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
    response = await fetch(hook.url, { method: 'POST' });
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
