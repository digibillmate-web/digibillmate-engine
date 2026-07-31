/**
 * Supabase clients for build-time data access.
 *
 * Both are server-only. Nothing here may be imported from a client-side
 * script — `astro:env/server` will refuse to build if you try.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from 'astro:env/server';

/** Respects RLS. Use for anything a published site could legitimately read. */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/**
 * Bypasses RLS. Only for the export/build pipeline, never for rendering
 * user-supplied input. Throws if the key is not configured.
 */
export function getAdminClient(): SupabaseClient {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to site-builder/.env to use the admin client.',
    );
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
