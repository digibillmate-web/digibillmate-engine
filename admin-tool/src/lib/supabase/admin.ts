import 'server-only';

/**
 * Service-role Supabase client. Bypasses RLS entirely.
 *
 * The `server-only` import above is a build-time guard: if any client
 * component ever imports this module, the build fails rather than shipping
 * the key to a browser bundle.
 *
 * Use only where admin privileges are genuinely required — never to serve
 * data a user's own session could have fetched.
 */
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in admin-tool/.env.local',
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
