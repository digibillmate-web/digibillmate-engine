import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Templates as snapshots of a site.
 *
 * The workflow this serves: build one excellent site for a trade by hand, save
 * it as the template, then every site after starts from it and differs only in
 * words, colours and photographs. That is the whole economic argument for the
 * engine — the first site in an industry costs days, the rest cost hours.
 *
 * A snapshot carries pages, because a template that flattened a six-page site
 * to one would lose the part that takes longest to rebuild.
 */

export interface TemplatePage {
  slug: string;
  title: string;
  navLabel: string | null;
  position: number;
  showInNav: boolean;
  revealAnimation: string | null;
  themeOverrides: Record<string, unknown>;
  blocks: TemplateBlock[];
}

export interface TemplateBlock {
  blockDefinitionId: string;
  position: number;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface TemplateComposition {
  version: 1;
  pages: TemplatePage[];
}

/**
 * Reads a site into a template composition.
 *
 * Published content only, never content_draft: a pending draft is an
 * unreviewed edit, and baking one into a template would propagate it to every
 * site built from it afterwards.
 *
 * Hidden blocks are kept. Hiding is a per-site decision about what to show
 * today, not a statement that the block does not belong in the template.
 */
export async function snapshotSite(
  supabase: SupabaseClient,
  siteId: string,
): Promise<{ ok: boolean; composition?: TemplateComposition; error?: string }> {
  const { data: pages, error: pageError } = await supabase
    .from('site_pages')
    .select('id, slug, title, nav_label, position, show_in_nav, reveal_animation, theme_overrides')
    .eq('site_id', siteId)
    .order('position', { ascending: true });

  if (pageError) return { ok: false, error: `Could not read pages: ${pageError.message}` };
  if (!pages || pages.length === 0) {
    return { ok: false, error: 'This site has no pages, so there is nothing to save.' };
  }

  const { data: blocks, error: blockError } = await supabase
    .from('block_instances')
    .select('page_id, block_definition_id, position, content, settings')
    .eq('site_id', siteId)
    .order('position', { ascending: true });

  if (blockError) return { ok: false, error: `Could not read blocks: ${blockError.message}` };
  if (!blocks || blocks.length === 0) {
    return { ok: false, error: 'This site has no blocks, so the template would be empty.' };
  }

  const composition: TemplateComposition = {
    version: 1,
    pages: pages.map((page) => ({
      slug: (page.slug as string) ?? '',
      title: page.title as string,
      navLabel: (page.nav_label as string | null) ?? null,
      position: page.position as number,
      showInNav: page.show_in_nav !== false,
      revealAnimation: (page.reveal_animation as string | null) ?? null,
      themeOverrides: (page.theme_overrides ?? {}) as Record<string, unknown>,
      blocks: blocks
        .filter((block) => block.page_id === page.id)
        .map((block) => ({
          blockDefinitionId: block.block_definition_id as string,
          position: block.position as number,
          content: (block.content ?? {}) as Record<string, unknown>,
          settings: (block.settings ?? {}) as Record<string, unknown>,
        })),
    })),
  };

  const home = composition.pages.find((page) => page.slug === '');
  if (!home) {
    return { ok: false, error: 'This site has no home page, so the template could not be built.' };
  }

  return { ok: true, composition };
}

/**
 * Builds a site's pages and blocks from a template composition.
 *
 * Used in place of the archetype_blocks path when the archetype carries one.
 * Both paths exist because the original archetype was seeded as flat blocks
 * and still works that way; nothing is gained by rewriting it.
 */
export async function applyComposition(
  supabase: SupabaseClient,
  siteId: string,
  composition: TemplateComposition,
): Promise<{ ok: boolean; blocks: number; error?: string }> {
  if (!composition?.pages?.length) {
    return { ok: false, blocks: 0, error: 'The template has no pages.' };
  }

  const { data: createdPages, error: pageError } = await supabase
    .from('site_pages')
    .insert(
      composition.pages.map((page) => ({
        site_id: siteId,
        slug: page.slug,
        title: page.title,
        nav_label: page.navLabel,
        position: page.position,
        show_in_nav: page.showInNav,
        reveal_animation: page.revealAnimation,
        theme_overrides: page.themeOverrides ?? {},
      })),
    )
    .select('id, slug');

  if (pageError || !createdPages) {
    return { ok: false, blocks: 0, error: `Could not create pages: ${pageError?.message}` };
  }

  const pageIdBySlug = new Map(createdPages.map((page) => [page.slug as string, page.id as string]));

  const rows = composition.pages.flatMap((page) =>
    page.blocks.map((block) => ({
      site_id: siteId,
      page_id: pageIdBySlug.get(page.slug),
      block_definition_id: block.blockDefinitionId,
      position: block.position,
      content: block.content ?? {},
      settings: block.settings ?? {},
    })),
  );

  if (rows.length === 0) return { ok: true, blocks: 0 };

  const { error: blockError } = await supabase.from('block_instances').insert(rows);

  if (blockError) {
    return { ok: false, blocks: 0, error: `Could not create blocks: ${blockError.message}` };
  }

  return { ok: true, blocks: rows.length };
}
