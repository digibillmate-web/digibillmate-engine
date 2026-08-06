'use server';

/**
 * Mail settings for one site's enquiry notifications.
 *
 * Kept apart from the theme and content actions because it is operational
 * rather than editorial: it decides where notifications land and how many the
 * shared sending account will spend on this site.
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface MailSettingsResult {
  ok: boolean;
  error?: string;
}

/** Deliberately permissive: real addresses defeat stricter patterns. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function saveMailSettings(
  siteId: string,
  input: { email: string; notify: boolean; monthlyLimit: string },
): Promise<MailSettingsResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not signed in.' };

  const email = input.email.trim();
  if (email && !EMAIL.test(email)) {
    return { ok: false, error: `"${email}" does not look like an email address.` };
  }

  /*
   * Blank means no limit, which is different from zero. Zero is a real
   * setting — it stops notifications while still recording enquiries — so the
   * two cannot collapse into the same value.
   */
  const raw = input.monthlyLimit.trim();
  let monthlyLimit: number | null = null;

  if (raw !== '') {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, error: 'Monthly limit must be a whole number, or blank for no limit.' };
    }
    monthlyLimit = parsed;
  }

  const { data, error } = await supabase
    .from('sites')
    .update({
      enquiry_email: email || null,
      enquiry_notify: input.notify,
      enquiry_monthly_limit: monthlyLimit,
    })
    .eq('id', siteId)
    .select('id');

  if (error) return { ok: false, error: error.message };

  if (!data || data.length === 0) {
    return { ok: false, error: 'No site updated — your account may lack admin rights.' };
  }

  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}
