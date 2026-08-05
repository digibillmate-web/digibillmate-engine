'use server';

/**
 * Page CRUD for a site.
 *
 * Pages own blocks, so deleting one takes its blocks with it (FK cascade).
 * The home page is protected: a site with no home page exports nothing and
 * fails its next build, which is a confusing way to discover a mistake.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { validateSlug, normaliseSlug } from '@/lib/page-slug';
import { PAGE_OVERRIDE_TOKENS, REVEAL_VALUES } from '@/lib/page-appearance';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PageResult {
  ok: boolean;
  error?: string;
  pageId?: string;
}

const UNIQUE_VIOLATION = '23505';

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function createPage(
  siteId: string,
  input: { slug: string; title: string; showInNav: boolean },
): Promise<PageResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const title = input.title?.trim();
  const slug = normaliseSlug(input.slug ?? '');

  if (!title) return { ok: false, error: 'Page title is required.' };

  const slugError = validateSlug(slug);
  if (slugError) return { ok: false, error: slugError };

  const { data: last } = await supabase
    .from('site_pages')
    .select('position')
    .eq('site_id', siteId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('site_pages')
    .insert({
      site_id: siteId,
      slug,
      title,
      position: (last?.position ?? 0) + 1,
      show_in_nav: input.showInNav,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: `This site already has a page at /${slug}.` };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true, pageId: data.id };
}

export async function updatePage(
  siteId: string,
  pageId: string,
  input: { slug: string; title: string; showInNav: boolean },
): Promise<PageResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'Page title is required.' };

  const { data: existing } = await supabase
    .from('site_pages')
    .select('slug')
    .eq('id', pageId)
    .eq('site_id', siteId)
    .single();

  if (!existing) return { ok: false, error: 'Page not found.' };

  // The home page's slug is what makes it the home page. Renaming it would
  // leave the site without an index.
  const isHome = existing.slug === '';
  const slug = isHome ? '' : normaliseSlug(input.slug ?? '');

  if (!isHome) {
    const slugError = validateSlug(slug);
    if (slugError) return { ok: false, error: slugError };
  }

  const { data, error } = await supabase
    .from('site_pages')
    .update({ slug, title, show_in_nav: input.showInNav })
    .eq('id', pageId)
    .eq('site_id', siteId)
    .select('id');

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: `This site already has a page at /${slug}.` };
    }
    return { ok: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { ok: false, error: 'No page updated — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true, pageId };
}

/**
 * A page's own accent colours and reveal style.
 *
 * Separate from updatePage so renaming a page stays a two-field operation.
 * Blank overrides are stripped rather than stored as empty strings: an empty
 * custom property is still a declaration, and it would blank the colour on
 * the page rather than falling back to the site theme.
 */
export async function updatePageAppearance(
  siteId: string,
  pageId: string,
  input: { overrides: Record<string, string>; revealAnimation: string },
): Promise<PageResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const overrides = Object.fromEntries(
    Object.entries(input.overrides ?? {})
      .map(([key, value]) => [key, String(value ?? '').trim()])
      .filter(([, value]) => value !== ''),
  );

  const unknownToken = Object.keys(overrides).find(
    (key) => !PAGE_OVERRIDE_TOKENS.some((token) => token.key === key),
  );
  if (unknownToken) {
    return { ok: false, error: `${unknownToken} is not a page-level colour.` };
  }

  const reveal = input.revealAnimation?.trim() || null;
  if (reveal && !REVEAL_VALUES.includes(reveal)) {
    return { ok: false, error: `${reveal} is not one of the available animations.` };
  }

  const { data, error } = await supabase
    .from('site_pages')
    .update({ theme_overrides: overrides, reveal_animation: reveal })
    .eq('id', pageId)
    .eq('site_id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) {
    return { ok: false, error: 'No page updated — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true, pageId };
}

export async function deletePage(
  siteId: string,
  pageId: string,
  confirmTitle: string,
): Promise<PageResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data: page } = await supabase
    .from('site_pages')
    .select('id, slug, title')
    .eq('id', pageId)
    .eq('site_id', siteId)
    .single();

  if (!page) return { ok: false, error: 'Page not found.' };

  if (page.slug === '') {
    return {
      ok: false,
      error:
        'The home page cannot be deleted — a site without one exports nothing and ' +
        'fails its next build.',
    };
  }

  if (confirmTitle.trim() !== page.title) {
    return { ok: false, error: 'The title you typed does not match this page.' };
  }

  // block_instances cascade from site_pages, so the page's blocks go with it.
  const { data, error } = await supabase
    .from('site_pages')
    .delete()
    .eq('id', pageId)
    .eq('site_id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Nothing was deleted — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

/** Applies a new page order as one statement. */
export async function reorderPages(
  siteId: string,
  orderedPageIds: string[],
): Promise<PageResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data: existing, error: readError } = await supabase
    .from('site_pages')
    .select('id, site_id, slug, title')
    .eq('site_id', siteId);

  if (readError) return { ok: false, error: readError.message };

  const known = new Set((existing ?? []).map((row) => row.id as string));
  if (orderedPageIds.length !== known.size || orderedPageIds.some((id) => !known.has(id))) {
    return { ok: false, error: 'The page list is out of date. Reload and try again.' };
  }

  const byId = new Map((existing ?? []).map((row) => [row.id as string, row]));

  const rows = orderedPageIds.map((id, index) => ({
    id,
    site_id: siteId,
    slug: byId.get(id)!.slug,
    title: byId.get(id)!.title,
    position: index + 1,
  }));

  const { error } = await supabase.from('site_pages').upsert(rows, { onConflict: 'id' });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}
