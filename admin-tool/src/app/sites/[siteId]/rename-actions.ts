'use server';

/**
 * Site identity: the internal label and the subdomain.
 *
 * sites.name is the internal label ("Maria Cars - Guindy") — not shown on the
 * built site, which is why it lives on Settings rather than in the block
 * content forms. It has no relation to header_nav.business_name or
 * footer.business_name, which are what the built pages actually display.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { validateSubdomain } from '@/lib/site-provisioning';

export interface RenameResult {
  ok: boolean;
  error?: string;
}

const UNIQUE_VIOLATION = '23505';

export async function renameSite(siteId: string, name: string): Promise<RenameResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Site name cannot be empty.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('sites')
    .update({ name: trimmed })
    .eq('id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'No row updated — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath('/sites');
  return { ok: true };
}

/**
 * Changes the subdomain.
 *
 * This is the site's address, so it is not a cosmetic edit: the exported JSON
 * is named after it, and any Cloudflare project or DNS record pointing at the
 * old value keeps pointing there. The caller is warned rather than stopped,
 * because renaming before a site is live is perfectly normal.
 */
export async function changeSubdomain(siteId: string, subdomain: string): Promise<RenameResult> {
  const value = subdomain.trim().toLowerCase();

  const invalid = validateSubdomain(value);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Friendly pre-check; the unique index is still the real guard.
  const { data: clash } = await supabase
    .from('sites')
    .select('id')
    .eq('subdomain', value)
    .neq('id', siteId)
    .maybeSingle();

  if (clash) return { ok: false, error: `Subdomain "${value}" is already taken.` };

  const { data, error } = await supabase
    .from('sites')
    .update({ subdomain: value })
    .eq('id', siteId)
    .select('id');

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: `Subdomain "${value}" was taken a moment ago. Pick another.` };
    }
    return { ok: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'No row updated — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath('/sites');
  return { ok: true };
}
