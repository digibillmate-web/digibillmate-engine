/**
 * One-site build: export from Supabase, then build the Astro site.
 *
 *   SITE_ID=<uuid> npm run build:site
 *
 * This is the command a Cloudflare Pages project runs. Each project builds
 * exactly one site, identified by the SITE_ID environment variable.
 *
 * Every failure is fatal and non-zero. A build that silently falls back to
 * stale or fixture data would publish the wrong content to a client's domain,
 * so there is no fallback path here at all.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_BUILDER = join(ROOT, 'site-builder');
const DATA_DIR = join(SITE_BUILDER, 'src/data/sites');

function fail(message) {
  console.error(`\n✖ build:site — ${message}\n`);
  process.exit(1);
}

function run(label, command, args, cwd) {
  console.log(`\n▶ ${label}`);

  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}`);
}

// --- 1. Required configuration ---------------------------------------------

const { SITE_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SITE_ID) {
  fail(
    'SITE_ID is not set. Each Cloudflare Pages project builds exactly one ' +
      'site — set SITE_ID to that site\'s uuid in the project settings.',
  );
}

const missing = [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
].filter(([, value]) => !value);

if (missing.length > 0) {
  fail(
    `Missing required env var(s): ${missing.map(([name]) => name).join(', ')}. ` +
      'The export step reads these to fetch site data from Supabase.',
  );
}

console.log(`Building site ${SITE_ID}`);

// --- 2. Clear stale exports -------------------------------------------------

// One build renders one site, and the renderer refuses to guess between
// multiple exports. Clearing first makes local rebuilds deterministic.
if (existsSync(DATA_DIR)) {
  const stale = readdirSync(DATA_DIR).filter((file) => file.endsWith('.json'));

  for (const file of stale) {
    rmSync(join(DATA_DIR, file));
  }

  if (stale.length > 0) {
    console.log(`  cleared ${stale.length} previous export(s)`);
  }
}

// --- 3. Export from Supabase ------------------------------------------------

run('export', process.execPath, [join(ROOT, 'scripts/export-site.mjs'), SITE_ID], ROOT);

const exported = existsSync(DATA_DIR)
  ? readdirSync(DATA_DIR).filter((file) => file.endsWith('.json'))
  : [];

if (exported.length !== 1) {
  fail(
    `Expected the export to write exactly one JSON file, found ${exported.length}. ` +
      'Refusing to build against ambiguous data.',
  );
}

console.log(`  exported ${exported[0]}`);

// --- 4. Build the Astro site ------------------------------------------------

// Invoke Astro's JS entry point directly rather than going through `npm run`.
// npm and the .bin shims are .cmd files on Windows, which Node refuses to
// spawn without a shell — and a shell would mis-split "C:\Program Files\...".
// This path is identical on every platform.
const ASTRO_BIN = join(SITE_BUILDER, 'node_modules/astro/bin/astro.mjs');

if (!existsSync(ASTRO_BIN)) {
  fail(
    'site-builder dependencies are not installed (astro not found). ' +
      'Run `npm install` at the repo root — its postinstall installs them.',
  );
}

run('astro build', process.execPath, [ASTRO_BIN, 'build'], SITE_BUILDER);

console.log(`\n✔ build:site complete — output in site-builder/dist\n`);
