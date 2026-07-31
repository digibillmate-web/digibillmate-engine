/**
 * Shape of an exported site JSON file.
 *
 * Produced by `scripts/export-site.mjs` at the repo root, consumed by the
 * Astro routes at build time. This is the only thing the renderer sees — the
 * build never talks to Supabase directly.
 */
import type { BlockContent } from './blocks';

export interface ExportedSite {
  id: string;
  subdomain: string;
  customDomain: string | null;
  status: string;
  /** Resolved CSS custom properties, already prefixed (--dbm-*). */
  theme: Record<string, string>;
  /** Ordered by `position`. */
  blocks: BlockContent[];
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
