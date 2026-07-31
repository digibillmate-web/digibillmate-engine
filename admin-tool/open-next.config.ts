import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext Cloudflare adapter config.
 *
 * No incremental cache is configured: every data route in this app is
 * `force-dynamic` and reads per-user data through RLS, so there is nothing
 * safe to cache between requests. Add an R2/KV incremental cache only if a
 * genuinely static or revalidated route appears.
 */
export default defineCloudflareConfig({});
