'use server';

/**
 * Client record CRUD.
 *
 * Named *Record to avoid colliding with the Supabase `createClient` helper,
 * which means something entirely different in this codebase.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface ClientInput {
  name: string;
  businessType?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export interface ClientResult {
  ok: boolean;
  clientId?: string;
  error?: string;
}

/** Empty strings become null so "not set" is one value, not two. */
function clean(value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function validate(input: ClientInput): string | null {
  if (!input.name?.trim()) return 'Business name is required.';
  const email = input.contactEmail?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'That does not look like a valid email address.';
  }
  return null;
}

function toRow(input: ClientInput) {
  return {
    name: input.name.trim(),
    business_type: clean(input.businessType),
    contact_name: clean(input.contactName),
    contact_email: clean(input.contactEmail),
    contact_phone: clean(input.contactPhone),
    notes: clean(input.notes),
  };
}

export async function createClientRecord(input: ClientInput): Promise<ClientResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase.from('clients').insert(toRow(input)).select('id').single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/clients');
  return { ok: true, clientId: data.id };
}

/**
 * Deletes a client, but only once it owns no sites.
 *
 * sites.client_id cascades, so deleting a client with sites would take those
 * sites and every block of content with them. That is never what someone
 * clicking "delete client" means, so it is refused rather than confirmed —
 * the site deletions have their own confirmation for a reason.
 */
export async function deleteClientRecord(
  clientId: string,
  confirmName: string,
): Promise<ClientResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: client, error: readError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .single();

  if (readError || !client) {
    return { ok: false, error: 'Client not found, or not visible to your account.' };
  }

  // Re-checked here rather than trusting the count the page rendered, which
  // may be minutes stale.
  const { data: sites, error: sitesError } = await supabase
    .from('sites')
    .select('name')
    .eq('client_id', clientId);

  if (sitesError) return { ok: false, error: sitesError.message };

  if (sites && sites.length > 0) {
    const names = sites.map((s) => s.name).join(', ');
    return {
      ok: false,
      error:
        `${client.name} still owns ${sites.length} site${sites.length === 1 ? '' : 's'}: ${names}. ` +
        'Delete or reassign them first — deleting the client would take them with it.',
    };
  }

  if (confirmName.trim() !== client.name) {
    return { ok: false, error: 'The name you typed does not match this client.' };
  }

  const { data, error } = await supabase.from('clients').delete().eq('id', clientId).select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Nothing was deleted — your account may lack admin rights.' };
  }

  revalidatePath('/clients');
  return { ok: true, clientId };
}

export async function updateClientRecord(
  clientId: string,
  input: ClientInput,
): Promise<ClientResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('clients')
    .update(toRow(input))
    .eq('id', clientId)
    .select('id');

  if (error) return { ok: false, error: error.message };

  // RLS refuses by matching no rows rather than erroring.
  if (!data || data.length === 0) {
    return { ok: false, error: 'No row updated — your account may lack admin rights.' };
  }

  revalidatePath('/clients');
  return { ok: true, clientId };
}
