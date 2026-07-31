import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Site provisioning: the logic migration 0005 performed once by hand, as
 * reusable server-side code.
 *
 * A site's composition lives in its own block_instances rows. The archetype
 * only supplies the starting point, copied in at creation time — the export
 * pipeline reads block_instances and never the archetype, so a site with no
 * instances renders nothing.
 */

export interface BackfillResult {
  ok: boolean;
  inserted: number;
  error?: string;
}

/**
 * Copies an archetype's blocks into a site as block_instances.
 *
 * Idempotent in the same way 0005 was: positions the site already has are
 * skipped, so re-running cannot duplicate or overwrite content.
 */
export async function backfillBlockInstances(
  supabase: SupabaseClient,
  siteId: string,
  archetypeId: string,
): Promise<BackfillResult> {
  const { data: archetypeBlocks, error: readError } = await supabase
    .from('archetype_blocks')
    .select('block_definition_id, position, default_content')
    .eq('archetype_id', archetypeId)
    .order('position', { ascending: true });

  if (readError) {
    return { ok: false, inserted: 0, error: `Could not read archetype blocks: ${readError.message}` };
  }

  if (!archetypeBlocks || archetypeBlocks.length === 0) {
    return {
      ok: false,
      inserted: 0,
      error: 'That archetype has no blocks, so the site would render an empty page.',
    };
  }

  const { data: existing, error: existingError } = await supabase
    .from('block_instances')
    .select('position')
    .eq('site_id', siteId);

  if (existingError) {
    return { ok: false, inserted: 0, error: `Could not read block instances: ${existingError.message}` };
  }

  const taken = new Set((existing ?? []).map((row) => row.position as number));

  const rows = archetypeBlocks
    .filter((block) => !taken.has(block.position as number))
    .map((block) => ({
      site_id: siteId,
      block_definition_id: block.block_definition_id,
      position: block.position,
      content: block.default_content ?? {},
    }));

  if (rows.length === 0) return { ok: true, inserted: 0 };

  const { error: insertError } = await supabase.from('block_instances').insert(rows);

  if (insertError) {
    return { ok: false, inserted: 0, error: `Could not create blocks: ${insertError.message}` };
  }

  return { ok: true, inserted: rows.length };
}

/** Subdomain rules: DNS-label shaped, and what the unique index expects. */
export function validateSubdomain(value: string): string | null {
  if (!value) return 'Subdomain is required.';
  if (value.length < 3) return 'Subdomain must be at least 3 characters.';
  if (value.length > 63) return 'Subdomain must be 63 characters or fewer.';
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return 'Use lowercase letters, numbers and hyphens only, not starting or ending with a hyphen.';
  }
  return null;
}

/** Normalises user input toward a valid subdomain rather than rejecting it. */
export function normaliseSubdomain(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
