'use server';

/**
 * Site cloning.
 *
 * Copies a source site's *content* — its block_instances and theme — into a
 * brand new site. Deliberately does not copy anything tied to the original's
 * Cloudflare project: the deploy hook and last_published_at belong to that
 * deployment, not to the content.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { validateSubdomain } from '@/lib/site-provisioning';

export interface CloneSiteInput {
  sourceSiteId: string;
  name: string;
  subdomain: string;
  /** Reassign to a different client; defaults to the source's client. */
  clientId?: string;
}

export interface CloneSiteResult {
  ok: boolean;
  siteId?: string;
  blocksCopied?: number;
  error?: string;
}

const UNIQUE_VIOLATION = '23505';

export async function cloneSite(input: CloneSiteInput): Promise<CloneSiteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  const name = input.name?.trim();
  const subdomain = input.subdomain?.trim().toLowerCase();

  if (!name) return { ok: false, error: 'Site name is required.' };

  const subdomainError = validateSubdomain(subdomain);
  if (subdomainError) return { ok: false, error: subdomainError };

  // --- source -------------------------------------------------------------

  const { data: source, error: sourceError } = await supabase
    .from('sites')
    .select('id, client_id, archetype_id, theme, composition_linked, theme_linked')
    .eq('id', input.sourceSiteId)
    .single();

  if (sourceError || !source) {
    return { ok: false, error: 'Source site not found, or not visible to your account.' };
  }

  const { data: sourceBlocks, error: blocksError } = await supabase
    .from('block_instances')
    .select('block_definition_id, position, content, settings')
    .eq('site_id', source.id)
    .order('position', { ascending: true });

  if (blocksError) {
    return { ok: false, error: `Could not read source blocks: ${blocksError.message}` };
  }

  if (!sourceBlocks || sourceBlocks.length === 0) {
    return { ok: false, error: 'The source site has no blocks, so the clone would be empty.' };
  }

  const { data: clash } = await supabase
    .from('sites')
    .select('id')
    .eq('subdomain', subdomain)
    .maybeSingle();

  if (clash) return { ok: false, error: `Subdomain "${subdomain}" is already taken.` };

  // --- new site -----------------------------------------------------------

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .insert({
      client_id: input.clientId || source.client_id,
      archetype_id: source.archetype_id,
      name,
      subdomain,
      // Theme travels with the content.
      theme: source.theme ?? {},
      // A clone starts linked and unpublished regardless of the source's
      // state — it is a new site, not a continuation of the original.
      composition_linked: true,
      theme_linked: true,
      status: 'draft',
      // custom_domain, last_published_at and the deploy hook are all
      // deliberately absent: they belong to the original's deployment.
    })
    .select('id')
    .single();

  if (siteError || !site) {
    if (siteError?.code === UNIQUE_VIOLATION) {
      return { ok: false, error: `Subdomain "${subdomain}" was taken a moment ago. Pick another.` };
    }
    return { ok: false, error: `Could not create the clone: ${siteError?.message}` };
  }

  // --- copy content -------------------------------------------------------

  // content only, never content_draft: a pending draft on the source is an
  // unreviewed edit and has no meaning on a different site.
  const rows = sourceBlocks.map((block) => ({
    site_id: site.id,
    block_definition_id: block.block_definition_id,
    position: block.position,
    content: block.content ?? {},
    settings: block.settings ?? {},
  }));

  const { error: copyError } = await supabase.from('block_instances').insert(rows);

  if (copyError) {
    // No transactions through PostgREST — undo rather than leave a blockless site.
    await supabase.from('sites').delete().eq('id', site.id);
    return { ok: false, error: `Could not copy blocks: ${copyError.message}` };
  }

  revalidatePath('/sites');

  return { ok: true, siteId: site.id, blocksCopied: rows.length };
}
