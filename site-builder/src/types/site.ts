/**
 * Shape of an exported site JSON file.
 *
 * Produced by `scripts/export-site.mjs` at the repo root, consumed by the
 * Astro routes at build time. This is the only thing the renderer sees — the
 * build never talks to Supabase directly.
 */
import type { BlockContent } from './blocks';

/** Reveal styles the site builder has CSS for. */
export type RevealAnimation = 'fade-up' | 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'none';

export interface ExportedPage {
  /** '' is the home page, which builds to /index.html. */
  slug: string;
  title: string;
  navLabel: string;
  showInNav: boolean;
  /**
   * Accent overrides for this page only, as --dbm-* custom properties. Absent
   * means the page follows the site theme, which is the usual case.
   */
  theme?: Record<string, string>;
  /** Absent means the site default. */
  revealAnimation?: RevealAnimation;
  /** Ordered by `position`. */
  blocks: BlockContent[];
}

export interface ExportedSite {
  id: string;
  subdomain: string;
  customDomain: string | null;
  status: string;
  /** Resolved CSS custom properties, already prefixed (--dbm-*). */
  theme: Record<string, string>;
  /** Ordered by `position`; the first is the home page. */
  pages: ExportedPage[];
  meta: {
    archetypeId: string | null;
    archetypeKey: string | null;
    /** Composition came from archetype_blocks rather than block_instances. */
    compositionLinked: boolean;
    themeLinked: boolean;
    /** Draft content was preferred over published content. */
    draft: boolean;
    exportedAt: string;
  };
}
