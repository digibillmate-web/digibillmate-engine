'use server';

/**
 * Saves a finished site as a reusable template.
 *
 * This is how a new industry enters the engine. Rather than a template builder
 * — a large editor used a handful of times a year — you build one excellent
 * site for the trade by hand, then promote it. Everything already exists: the
 * site editor is the template editor.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { snapshotSite } from '@/lib/template-snapshot';

export interface SaveTemplateResult {
  ok: boolean;
  error?: string;
  archetypeId?: string;
  pages?: number;
  blocks?: number;
}

/** Archetype keys are identifiers, not titles: stable, lowercase, no spaces. */
function toKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

export async function saveSiteAsTemplate(
  siteId: string,
  input: { name: string; industry: string; description: string; overwriteId?: string },
): Promise<SaveTemplateResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { ok: false, error: 'Saving a template requires an admin account.' };
  }

  const name = input.name?.trim();
  if (!name) return { ok: false, error: 'Template name is required.' };

  const industry = input.industry?.trim();
  if (!industry) return { ok: false, error: 'Industry is required — it is how templates group.' };

  const { data: site } = await supabase
    .from('sites')
    .select('id, name, theme')
    .eq('id', siteId)
    .single();

  if (!site) return { ok: false, error: 'Site not found.' };

  const snapshot = await snapshotSite(supabase, siteId);
  if (!snapshot.ok || !snapshot.composition) {
    return { ok: false, error: snapshot.error ?? 'Could not read the site.' };
  }

  const payload = {
    name,
    industry,
    description: input.description?.trim() || null,
    /*
     * The site's own theme becomes the template's default. A template whose
     * colours came from somewhere else would need retheming on every site
     * built from it, which is most of the work it exists to remove.
     */
    default_theme: site.theme ?? {},
    composition: snapshot.composition,
    source_site_name: site.name,
    updated_from_site_at: new Date().toISOString(),
  };

  /*
   * Updating an existing template is a deliberate, separate choice. Saving
   * over a template silently would change what every future site is built
   * from, on a click meant to create something new.
   */
  if (input.overwriteId) {
    const { data, error } = await supabase
      .from('archetypes')
      .update(payload)
      .eq('id', input.overwriteId)
      .select('id');

    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: 'Template not found, or not yours to change.' };

    revalidatePath('/templates');
    return {
      ok: true,
      archetypeId: input.overwriteId,
      pages: snapshot.composition.pages.length,
      blocks: snapshot.composition.pages.reduce((n, page) => n + page.blocks.length, 0),
    };
  }

  const { data, error } = await supabase
    .from('archetypes')
    .insert({ ...payload, key: toKey(name) })
    .select('id')
    .single();

  if (error) {
    // 23505: the key is unique, and two templates called the same thing is
    // the likeliest way to hit it.
    if (error.code === '23505') {
      return { ok: false, error: `A template called "${name}" already exists. Pick another name.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/templates');

  return {
    ok: true,
    archetypeId: data.id as string,
    pages: snapshot.composition.pages.length,
    blocks: snapshot.composition.pages.reduce((n, page) => n + page.blocks.length, 0),
  };
}
