'use server';

/**
 * Site creation.
 *
 * Runs on the cookie-bound anon client like every other write, so RLS decides
 * whether the caller may insert — not a check in this file.
 */
import { createClient } from '@/lib/supabase/server';
import { backfillBlockInstances, validateSubdomain } from '@/lib/site-provisioning';

export interface CreateSiteInput {
  /** Existing client to attach to. Ignored when newClientName is given. */
  clientId?: string;
  /** Create a client inline instead of picking one. */
  newClientName?: string;
  newClientBusinessType?: string;
  newClientContactName?: string;
  newClientContactEmail?: string;
  newClientContactPhone?: string;

  archetypeId: string;
  name: string;
  subdomain: string;
}

export interface CreateSiteResult {
  ok: boolean;
  siteId?: string;
  blocksCreated?: number;
  error?: string;
  /** Which form field the error belongs to, when it is a field problem. */
  field?: 'subdomain' | 'name' | 'client' | 'archetype';
}

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505';

export async function createSite(input: CreateSiteInput): Promise<CreateSiteResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  const name = input.name?.trim();
  const subdomain = input.subdomain?.trim().toLowerCase();

  if (!name) return { ok: false, error: 'Site name is required.', field: 'name' };
  if (!input.archetypeId) {
    return { ok: false, error: 'Choose an archetype.', field: 'archetype' };
  }

  const subdomainError = validateSubdomain(subdomain);
  if (subdomainError) return { ok: false, error: subdomainError, field: 'subdomain' };

  const wantsNewClient = Boolean(input.newClientName?.trim());
  if (!wantsNewClient && !input.clientId) {
    return { ok: false, error: 'Choose a client, or create a new one.', field: 'client' };
  }

  // Friendly pre-check. The unique index is still the real guard — another
  // tab could take the subdomain between this read and the insert below.
  const { data: clash } = await supabase
    .from('sites')
    .select('id')
    .eq('subdomain', subdomain)
    .maybeSingle();

  if (clash) {
    return { ok: false, error: `Subdomain "${subdomain}" is already taken.`, field: 'subdomain' };
  }

  // --- client -------------------------------------------------------------

  let clientId = input.clientId;
  let createdClientId: string | null = null;

  if (wantsNewClient) {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert({
        name: input.newClientName!.trim(),
        business_type: input.newClientBusinessType?.trim() || null,
        contact_name: input.newClientContactName?.trim() || null,
        contact_email: input.newClientContactEmail?.trim() || null,
        contact_phone: input.newClientContactPhone?.trim() || null,
      })
      .select('id')
      .single();

    if (clientError || !client) {
      return { ok: false, error: `Could not create client: ${clientError?.message}`, field: 'client' };
    }

    clientId = client.id;
    createdClientId = client.id;
  }

  // --- site ---------------------------------------------------------------

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .insert({
      client_id: clientId,
      archetype_id: input.archetypeId,
      name,
      subdomain,
      // A new site tracks its archetype and starts unpublished. Explicit
      // rather than relying on column defaults, since these are decisions.
      composition_linked: true,
      theme_linked: true,
      status: 'draft',
    })
    .select('id')
    .single();

  if (siteError || !site) {
    // Do not leave an orphan client behind if the site never existed.
    if (createdClientId) await supabase.from('clients').delete().eq('id', createdClientId);

    if (siteError?.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        error: `Subdomain "${subdomain}" was taken a moment ago. Pick another.`,
        field: 'subdomain',
      };
    }

    return { ok: false, error: `Could not create site: ${siteError?.message}` };
  }

  // --- blocks -------------------------------------------------------------

  const backfill = await backfillBlockInstances(supabase, site.id, input.archetypeId);

  if (!backfill.ok) {
    // PostgREST gives us no transaction, so undo by hand. A site with no
    // blocks would export nothing and fail its first build confusingly.
    await supabase.from('sites').delete().eq('id', site.id);
    if (createdClientId) await supabase.from('clients').delete().eq('id', createdClientId);

    return { ok: false, error: backfill.error ?? 'Could not create the site blocks.' };
  }

  return { ok: true, siteId: site.id, blocksCreated: backfill.inserted };
}
