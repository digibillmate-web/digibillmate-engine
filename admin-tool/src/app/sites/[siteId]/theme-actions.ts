'use server';

/**
 * Theme writes.
 *
 * Saving a theme forks the site from its archetype, for the same reason a
 * composition change does: the flags mean "still tracking the archetype", and
 * a hand-picked colour plainly is not. Leaving theme_linked true would mean
 * the next archetype change silently discarded the operator's choice.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { THEME_TOKENS, type ThemeValues } from '@/lib/theme';

export interface ThemeResult {
  ok: boolean;
  error?: string;
  forked?: boolean;
}

const KNOWN = new Set(THEME_TOKENS.map((token) => token.key));

export async function saveTheme(siteId: string, theme: ThemeValues): Promise<ThemeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  // Only tokens the components consume. An unknown key would be stored,
  // exported as a --dbm-* variable, and never read by anything.
  const cleaned: ThemeValues = {};
  for (const [key, value] of Object.entries(theme)) {
    if (!KNOWN.has(key)) continue;
    const trimmed = String(value).trim();
    if (trimmed) cleaned[key] = trimmed;
  }

  const { data: site } = await supabase
    .from('sites')
    .select('theme_linked')
    .eq('id', siteId)
    .single();

  const wasLinked = Boolean(site?.theme_linked);

  const { data, error } = await supabase
    .from('sites')
    .update({ theme: cleaned, theme_linked: false })
    .eq('id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'No row updated — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true, forked: wasLinked };
}

/** Discards the site's own theme and goes back to following the archetype. */
export async function relinkTheme(siteId: string): Promise<ThemeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { error } = await supabase
    .from('sites')
    .update({ theme: {}, theme_linked: true })
    .eq('id', siteId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}
