'use server';

/**
 * Deploy hook writes.
 *
 * site_deploy_hooks is admin-only at the RLS level, so a non-admin session
 * simply matches no rows — the authorisation is Postgres's, not this file's.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface HookResult {
  ok: boolean;
  error?: string;
  hasHook?: boolean;
}

/** Cloudflare deploy hooks all share this shape; a typo here is a silent no-op later. */
const HOOK_PATTERN =
  /^https:\/\/api\.cloudflare\.com\/client\/v4\/pages\/webhooks\/deploy_hooks\/[A-Za-z0-9-]+$/;

export async function saveDeployHook(siteId: string, url: string): Promise<HookResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  const trimmed = url.trim();

  // Empty clears the hook, which is how you decommission a site's project.
  if (!trimmed) {
    const { error } = await supabase.from('site_deploy_hooks').delete().eq('site_id', siteId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/sites/${siteId}`);
    return { ok: true, hasHook: false };
  }

  if (!HOOK_PATTERN.test(trimmed)) {
    return {
      ok: false,
      error:
        'That does not look like a Cloudflare Pages deploy hook. Expected ' +
        'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/<id>',
    };
  }

  const { data, error } = await supabase
    .from('site_deploy_hooks')
    .upsert({ site_id: siteId, url: trimmed }, { onConflict: 'site_id' })
    .select('site_id');

  if (error) return { ok: false, error: error.message };

  // RLS refuses by matching no rows rather than erroring.
  if (!data || data.length === 0) {
    return { ok: false, error: 'Not permitted — your account needs admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true, hasHook: true };
}
