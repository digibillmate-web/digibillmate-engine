'use server';

/**
 * Composition edits: reorder, hide/show, add and permanently remove blocks.
 *
 * Every one of these forks the site from its archetype. That is the whole
 * point of composition_linked: once an operator changes which blocks exist or
 * what order they are in, the site no longer matches its archetype, and a
 * future archetype change must not silently overwrite that decision.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { emptyContentFromSchema } from '@/lib/schema-to-fields';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BlockActionResult {
  ok: boolean;
  error?: string;
  /** True when this action was what forked the site. */
  forked?: boolean;
}

/**
 * Marks the site as no longer tracking its archetype's composition.
 * Returns whether this call was the one that changed it.
 */
async function forkComposition(supabase: SupabaseClient, siteId: string): Promise<boolean> {
  const { data: site } = await supabase
    .from('sites')
    .select('composition_linked')
    .eq('id', siteId)
    .single();

  if (!site?.composition_linked) return false;

  const { error } = await supabase
    .from('sites')
    .update({ composition_linked: false })
    .eq('id', siteId);

  return !error;
}

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Applies a new order.
 *
 * Sent as one upsert so the whole reorder is a single statement. Migration
 * 0009 made unique (site_id, position) deferrable specifically for this —
 * without it, intermediate states during the update trip the constraint even
 * though the final state is valid.
 */
export async function reorderBlocks(
  siteId: string,
  orderedBlockIds: string[],
): Promise<BlockActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data: existing, error: readError } = await supabase
    .from('block_instances')
    .select('id, block_definition_id, site_id')
    .eq('site_id', siteId);

  if (readError) return { ok: false, error: readError.message };

  const known = new Set((existing ?? []).map((row) => row.id as string));

  // Refuse a partial list: silently dropping or duplicating a block because
  // the client sent a stale set would corrupt the composition.
  if (orderedBlockIds.length !== known.size || orderedBlockIds.some((id) => !known.has(id))) {
    return {
      ok: false,
      error: 'The block list is out of date. Reload the page and try again.',
    };
  }

  const byId = new Map((existing ?? []).map((row) => [row.id as string, row]));

  const rows = orderedBlockIds.map((id, index) => ({
    id,
    site_id: siteId,
    block_definition_id: byId.get(id)!.block_definition_id,
    position: index + 1,
  }));

  const { error } = await supabase.from('block_instances').upsert(rows, { onConflict: 'id' });

  if (error) return { ok: false, error: error.message };

  const forked = await forkComposition(supabase, siteId);
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, forked };
}

/** Hide or restore a block. Content and position survive either way. */
export async function setBlockHidden(
  siteId: string,
  blockId: string,
  hidden: boolean,
): Promise<BlockActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('block_instances')
    .update({ is_hidden: hidden })
    .eq('id', blockId)
    .eq('site_id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'No block updated — it may have been removed already.' };
  }

  const forked = await forkComposition(supabase, siteId);
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, forked };
}

/** Adds a block from the catalog, seeded with a blank shape from its schema. */
export async function addBlock(
  siteId: string,
  blockDefinitionId: string,
): Promise<BlockActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data: definition, error: defError } = await supabase
    .from('block_definitions')
    .select('id, key, schema')
    .eq('id', blockDefinitionId)
    .single();

  if (defError || !definition) return { ok: false, error: 'That block type no longer exists.' };

  const { data: last } = await supabase
    .from('block_instances')
    .select('position')
    .eq('site_id', siteId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (last?.position ?? 0) + 1;

  const { error } = await supabase.from('block_instances').insert({
    site_id: siteId,
    block_definition_id: definition.id,
    position: nextPosition,
    content: emptyContentFromSchema(definition.schema),
  });

  if (error) return { ok: false, error: error.message };

  const forked = await forkComposition(supabase, siteId);
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, forked };
}

/**
 * Permanently deletes a block instance and closes the gap in positions.
 *
 * Offered alongside hiding, not instead of it: hiding is the reversible
 * default, this is for blocks an operator is certain they will never want.
 */
export async function deleteBlock(siteId: string, blockId: string): Promise<BlockActionResult> {
  const supabase = await createClient();
  if (!(await requireUser(supabase))) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('block_instances')
    .delete()
    .eq('id', blockId)
    .eq('site_id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Nothing was deleted — the block may already be gone.' };
  }

  // Renumber what is left so positions stay 1..n with no holes.
  const { data: remaining } = await supabase
    .from('block_instances')
    .select('id, block_definition_id')
    .eq('site_id', siteId)
    .order('position', { ascending: true });

  if (remaining && remaining.length > 0) {
    await supabase.from('block_instances').upsert(
      remaining.map((row, index) => ({
        id: row.id,
        site_id: siteId,
        block_definition_id: row.block_definition_id,
        position: index + 1,
      })),
      { onConflict: 'id' },
    );
  }

  const forked = await forkComposition(supabase, siteId);
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, forked };
}
