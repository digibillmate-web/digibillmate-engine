'use server';

/**
 * Block content writes.
 *
 * Runs through the cookie-bound anon client, so the write is subject to RLS
 * exactly as it would be from the browser — an account without an admin
 * profile is rejected by Postgres, not by a check in this file. The
 * service-role client is deliberately not used here.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface SaveResult {
  ok: boolean;
  error?: string;
  savedAt?: string;
}

export async function saveBlockContent(
  siteId: string,
  blockId: string,
  content: unknown,
): Promise<SaveResult> {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return { ok: false, error: 'Block content must be a JSON object.' };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  // Scoped by site_id as well as id so a mismatched pair cannot write.
  const { data, error } = await supabase
    .from('block_instances')
    .update({ content })
    .eq('id', blockId)
    .eq('site_id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };

  // RLS rejects by matching zero rows rather than erroring, so an empty
  // result means "not permitted" (or the row is gone), not "nothing to do".
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'No row updated — the block may not exist, or your account lacks admin rights.',
    };
  }

  revalidatePath(`/sites/${siteId}`);

  return { ok: true, savedAt: new Date().toISOString() };
}
