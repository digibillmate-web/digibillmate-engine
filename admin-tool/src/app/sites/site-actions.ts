'use server';

/**
 * Site lifecycle: archive, restore, and hard delete.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Storage objects removed alongside a hard delete. */
  mediaRemoved?: number;
}

const BUCKET = 'site-media';

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Archiving is reversible and keeps every row — the default way to retire a site. */
export async function setSiteStatus(
  siteId: string,
  status: 'draft' | 'published' | 'archived',
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('sites')
    .update({ status })
    .eq('id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'No row updated — your account may lack admin rights.' };
  }

  revalidatePath('/sites');
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

/**
 * Removes every object this site uploaded.
 *
 * Storage is not part of the database, so nothing cascades into it. Without
 * this, deleting a site would silently orphan its images in the bucket for
 * ever, with no row left pointing at them.
 */
async function deleteSiteMedia(supabase: SupabaseClient, siteId: string): Promise<number> {
  const paths: string[] = [];

  const { data: folders } = await supabase.storage.from(BUCKET).list(siteId, { limit: 1000 });

  for (const folder of folders ?? []) {
    // A row with no id is a folder placeholder rather than an object.
    if (folder.id) {
      paths.push(`${siteId}/${folder.name}`);
      continue;
    }

    const { data: files } = await supabase.storage
      .from(BUCKET)
      .list(`${siteId}/${folder.name}`, { limit: 1000 });

    for (const file of files ?? []) paths.push(`${siteId}/${folder.name}/${file.name}`);
  }

  if (paths.length === 0) return 0;

  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) return 0;

  return paths.length;
}

/**
 * Hard delete. Irreversible.
 *
 * `confirmName` must match the site's name exactly — the caller has to have
 * looked at what they are destroying, not just clicked through a dialog.
 */
export async function deleteSite(siteId: string, confirmName: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data: site, error: readError } = await supabase
    .from('sites')
    .select('id, name, status')
    .eq('id', siteId)
    .single();

  if (readError || !site) {
    return { ok: false, error: 'Site not found, or not visible to your account.' };
  }

  if (confirmName.trim() !== site.name) {
    return { ok: false, error: 'The name you typed does not match this site.' };
  }

  // Media first: once the row is gone the site id is only in this closure,
  // and a failure here would leave objects nobody can trace back to a site.
  const mediaRemoved = await deleteSiteMedia(supabase, siteId);

  // block_instances and site_deploy_hooks both cascade from sites.
  const { data, error } = await supabase.from('sites').delete().eq('id', siteId).select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Nothing was deleted — your account may lack admin rights.' };
  }

  revalidatePath('/sites');
  return { ok: true, mediaRemoved };
}
