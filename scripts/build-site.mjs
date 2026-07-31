/**
 * One-site build: export from Supabase, then build the Astro site.
 *
 *   SITE_ID=<uuid> npm run build:site [-- --force]
 *
 * This is the command a Cloudflare Pages project runs. Each project builds
 * exactly one site, identified by the SITE_ID environment variable.
 *
 * Only sites with status 'published' build by default; --force overrides that
 * for deliberate preview/staging builds of draft sites.
 *
 * Every failure is fatal and non-zero. A build that silently falls back to
 * stale or fixture data would publish the wrong content to a client's domain,
 * so there is no fallback path here at all.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_BUILDER = join(ROOT, 'site-builder');
const DATA_DIR = join(SITE_BUILDER, 'src/data/sites');

/**
 * Abort the build. Throws rather than calling process.exit() — an immediate
 * exit while the Supabase HTTP socket is still closing trips a libuv assertion
 * on Windows and replaces the exit code with garbage, which would make a
 * blocked build look like a crash to CI.
 */
class BuildError extends Error {}

function fail(message) {
  throw new BuildError(message);
}

function run(label, command, args, cwd) {
  console.log(`\n▶ ${label}`);

  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}`);
}

async function main() {
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

const force = process.argv.slice(2).includes('--force');

console.log(`Building site ${SITE_ID}${force ? ' (--force)' : ''}`);

// --- 1b. Status gate --------------------------------------------------------

// Publishing a draft to a client's live domain is the expensive mistake here,
// so the default path refuses anything not marked published. Checked before
// the export so a blocked build does no work and touches no files.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: site, error: statusError } = await supabase
  .from('sites')
  .select('status')
  .eq('id', SITE_ID)
  .single();

if (statusError) {
  fail(`Could not read status for site ${SITE_ID}: ${statusError.message}`);
}

if (site.status !== 'published') {
  if (!force) {
    fail(
      `Site ${SITE_ID} is '${site.status}', not 'published' — refusing to ` +
        'build. Update status in Supabase or pass --force to override.',
    );
  }

  console.warn(
    `  ⚠ status is '${site.status}', not 'published' — building anyway (--force)`,
  );
} else {
  console.log('  status: published');
}

// Only a clean, unforced build of a published site counts as a publish. A
// forced build is a preview of something not meant to be live, so it must
// leave last_published_at alone.
const isRealPublish = !force && site.status === 'published';

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

// --- 5. Record the publish --------------------------------------------------

// Only after the build actually succeeded — stamping earlier would record a
// publish for a build that then failed and never shipped.
if (isRealPublish) {
  const publishedAt = new Date().toISOString();

  const { error: stampError } = await supabase
    .from('sites')
    .update({ last_published_at: publishedAt })
    .eq('id', SITE_ID);

  if (stampError) {
    fail(`Build succeeded but could not set last_published_at: ${stampError.message}`);
  }

  console.log(`  last_published_at set to ${publishedAt}`);
} else if (force) {
  console.log('  last_published_at unchanged (--force build)');
}

console.log(`\n✔ build:site complete — output in site-builder/dist\n`);
}

main().catch((error) => {
  const message = error instanceof BuildError ? error.message : (error.stack ?? String(error));
  console.error(`\n✖ build:site — ${message}\n`);
  // Set the code and let the process drain naturally; see fail() above.
  process.exitCode = 1;
});
