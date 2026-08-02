'use server';

/**
 * Per-block display settings.
 *
 * Separate from content: `content` is what the block says, `settings` is how
 * it is presented. Mixing them would put presentation choices into the
 * schema-driven content form, where they would look like fields a client
 * should fill in.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface SettingsResult {
  ok: boolean;
  error?: string;
}

/** Theme roles only — never a raw colour. See BlockRenderer for why. */
const BACKGROUNDS = new Set(['default', 'surface', 'primary', 'secondary']);

export async function setBlockBackground(
  siteId: string,
  blockId: string,
  background: string,
): Promise<SettingsResult> {
  if (!BACKGROUNDS.has(background)) {
    return { ok: false, error: `Unknown background "${background}".` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: block } = await supabase
    .from('block_instances')
    .select('settings')
    .eq('id', blockId)
    .eq('site_id', siteId)
    .single();

  if (!block) return { ok: false, error: 'Block not found.' };

  const settings = { ...((block.settings as Record<string, unknown>) ?? {}) };

  // 'default' means "no opinion", so the key is removed rather than stored —
  // otherwise every block carries a setting that does nothing.
  if (background === 'default') delete settings.background;
  else settings.background = background;

  const { data, error } = await supabase
    .from('block_instances')
    .update({ settings })
    .eq('id', blockId)
    .eq('site_id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'No block updated — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}
