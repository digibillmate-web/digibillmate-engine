'use server';

/**
 * sites.name is the internal label ("Maria Cars - Guindy") — not shown on the
 * built site, which is why it lives on Settings rather than in the block
 * content forms. It has no relation to header_nav.business_name or
 * footer.business_name, which are what the built pages actually display.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface RenameResult {
  ok: boolean;
  error?: string;
}

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
