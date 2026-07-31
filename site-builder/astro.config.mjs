// @ts-check
import { defineConfig, envField } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Static output: the engine exports site data to JSON, builds, and ships
  // the result to Cloudflare Pages.
  output: 'static',

  // Typed, validated env. Values come from site-builder/.env (gitignored).
  // Import them with: import { SUPABASE_URL } from 'astro:env/server';
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: 'server', access: 'public' }),
      SUPABASE_ANON_KEY: envField.string({ context: 'server', access: 'public' }),
      // Secret: build-time only, never inlined into client output.
      SUPABASE_SERVICE_ROLE_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
    },
  },
});
