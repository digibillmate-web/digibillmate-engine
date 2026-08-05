/**
 * Service-role Supabase client. One caller only: the public enquiry endpoint.
 *
 * This portal deliberately has no service-role key anywhere else — every other
 * query runs under the signed-in user's session so RLS applies exactly as it
 * would in the browser. That rule holds because every other action has a user
 * behind it.
 *
 * A form submission does not. It arrives from a static site with no session,
 * so something has to write the row on behalf of nobody. The alternatives are
 * worse: an anon insert policy would let anyone POST straight to PostgREST and
 * skip the honeypot, the rate limit and the site check, which is precisely the
 * validation the endpoint exists to perform.
 *
 * Bounded on purpose:
 *   - the key is a Worker secret, never NEXT_PUBLIC_, never sent to a browser
 *   - this module is imported by the enquiry route and nothing else
 *   - it writes enquiries; it is not a general-purpose admin client
 */
import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    // Loud, because the failure is otherwise a silently dropped enquiry.
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. The enquiry endpoint cannot store ' +
        'submissions without it — set it as a Worker secret.',
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
