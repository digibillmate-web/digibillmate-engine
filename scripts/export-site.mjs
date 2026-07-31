/**
 * Export one site's data from Supabase to a JSON file the Astro build consumes.
 *
 *   npm run export:site -- <site_id> [--draft] [--out <path>]
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the repo-root .env
 * (loaded by `node --env-file`). This is a server-side tool only — the service
 * role key bypasses RLS and must never reach site-builder's client env.
 *
 * Output shape matches site-builder/src/types/site.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT_DIR = resolve(ROOT, 'site-builder/src/data/sites');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { siteId: undefined, draft: false, out: undefined };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--draft') args.draft = true;
    else if (arg === '--out') args.out = argv[++i];
    else if (!arg.startsWith('-') && !args.siteId) args.siteId = arg;
  }

  return args;
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

/**
 * Normalize a theme jsonb blob into CSS custom properties.
 * Bare token names (`color-primary`) become `--dbm-color-primary`; values that
 * are already custom properties are passed through untouched.
 */
function toCssVars(theme) {
  if (!theme || typeof theme !== 'object') return {};

  return Object.fromEntries(
    Object.entries(theme)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [
        key.startsWith('--') ? key : `--dbm-${key.replace(/^dbm-/, '')}`,
        String(value),
      ]),
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { siteId, draft, out } = parseArgs(process.argv.slice(2));

  if (!siteId) fail('Usage: npm run export:site -- <site_id> [--draft] [--out <path>]');

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    fail('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the repo-root .env');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // --- Site -----------------------------------------------------------------

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select(
      'id, client_id, archetype_id, subdomain, custom_domain, theme, composition_linked, theme_linked, status',
    )
    .eq('id', siteId)
    .single();

  if (siteError) fail(`Could not load site ${siteId}: ${siteError.message}`);

  // --- Archetype (theme defaults, and composition when linked) --------------

  let archetype = null;
  if (site.archetype_id) {
    const { data, error } = await supabase
      .from('archetypes')
      .select('id, key, name, default_theme')
      .eq('id', site.archetype_id)
      .single();

    if (error) fail(`Could not load archetype ${site.archetype_id}: ${error.message}`);
    archetype = data;
  }

  // A linked site follows its archetype's theme; an unlinked one overrides it.
  const theme = site.theme_linked
    ? toCssVars(archetype?.default_theme)
    : { ...toCssVars(archetype?.default_theme), ...toCssVars(site.theme) };

  // --- Blocks ---------------------------------------------------------------

  let blocks;

  if (site.composition_linked) {
    // Composition is inherited: take the archetype's blocks and default content.
    if (!archetype) fail('Site is composition_linked but has no archetype_id');

    const { data, error } = await supabase
      .from('archetype_blocks')
      .select('position, default_content, block_definitions(key, name)')
      .eq('archetype_id', archetype.id)
      .order('position', { ascending: true });

    if (error) fail(`Could not load archetype blocks: ${error.message}`);

    blocks = data.map((row) => ({
      type: row.block_definitions?.key,
      content: row.default_content ?? {},
    }));
  } else {
    const { data, error } = await supabase
      .from('block_instances')
      .select('position, content, content_draft, settings, block_definitions(key, name)')
      .eq('site_id', site.id)
      .order('position', { ascending: true });

    if (error) fail(`Could not load block instances: ${error.message}`);

    blocks = data.map((row) => ({
      type: row.block_definitions?.key,
      // --draft previews unpublished edits; a null draft falls back to published.
      content: (draft ? (row.content_draft ?? row.content) : row.content) ?? {},
      ...(row.settings && Object.keys(row.settings).length > 0
        ? { settings: row.settings }
        : {}),
    }));
  }

  const unresolved = blocks.filter((block) => !block.type);
  if (unresolved.length > 0) {
    fail(`${unresolved.length} block(s) have no block_definitions.key — check the join`);
  }

  // --- Write ----------------------------------------------------------------

  const payload = {
    id: site.id,
    subdomain: site.subdomain,
    customDomain: site.custom_domain ?? null,
    status: site.status,
    theme,
    blocks,
    meta: {
      archetypeId: site.archetype_id ?? null,
      archetypeKey: archetype?.key ?? null,
      compositionLinked: Boolean(site.composition_linked),
      themeLinked: Boolean(site.theme_linked),
      draft,
      exportedAt: new Date().toISOString(),
    },
  };

  const outPath = out
    ? resolve(ROOT, out)
    : resolve(DEFAULT_OUT_DIR, `${site.subdomain ?? site.id}.json`);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    `✔ Exported ${blocks.length} block(s) for "${site.subdomain ?? site.id}"` +
      `${draft ? ' (draft)' : ''} → ${outPath}`,
  );
}

main().catch((error) => fail(error.stack ?? String(error)));
