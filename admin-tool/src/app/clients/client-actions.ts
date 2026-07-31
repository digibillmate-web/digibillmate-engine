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
