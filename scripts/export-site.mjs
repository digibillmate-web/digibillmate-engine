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
// Content mapping
// ---------------------------------------------------------------------------

/**
 * Translate stored content (shaped by `block_definitions.schema`) into the
 * props the Astro components take.
 *
 * The DB shape is authoritative: it is what the admin tool validates against
 * and what `client_editable_fields` names. The renderer adapts, not the schema,
 * so this file is the only place the two vocabularies meet.
 */
const CONTENT_MAPPERS = {
  header_nav: (c) => ({
    businessName: c.business_name,
    ...(c.logo_url
      ? { logo: { src: c.logo_url, alt: c.logo_alt ?? c.business_name ?? '' } }
      : {}),
    navLinks: (c.nav_links ?? []).map((l) => ({ label: l.label, href: l.href })),
    phone: c.phone,
    ...(c.cta_label ? { cta: { label: c.cta_label, href: c.cta_href ?? '#contact' } } : {}),
  }),

  floating_contact_bar: (c) => {
    // Pass through only the channels that actually carry a url.
    const channel = (value) => (value?.url ? { label: value.label ?? '', url: value.url } : undefined);

    return {
      call: channel(c.call),
      whatsapp: channel(c.whatsapp),
      facebook: channel(c.facebook),
      instagram: channel(c.instagram),
      youtube: channel(c.youtube),
    };
  },

  footer: (c) => ({
    businessName: c.business_name,
    tagline: c.tagline,
    servicesTitle: c.services_title,
    services: (c.services ?? []).map((s) => ({ label: s.label, href: s.href })),
    quickLinksTitle: c.quick_links_title,
    quickLinks: (c.quick_links ?? []).map((l) => ({ label: l.label, href: l.href })),
    contactTitle: c.contact_title,
    contact: c.contact,
    ...(c.qr_image_url
      ? { qr: { src: c.qr_image_url, alt: c.qr_caption ?? 'QR code' } }
      : {}),
    qrCaption: c.qr_caption,
    copyright: c.copyright,
  }),

  // --- Mapped but not yet rendered ------------------------------------------
  // These three have block definitions and seed content in Supabase, but no
  // Astro component yet. The mapper exists so the export completes; the
  // renderer will still throw on them until the components land.

  about_section: (c) => ({
    heading: c.heading,
    body: c.body,
    ...(c.image_url ? { image: { src: c.image_url, alt: c.image_alt ?? '' } } : {}),
    ...(c.read_more_label
      ? { readMore: { label: c.read_more_label, href: c.read_more_href ?? '#' } }
      : {}),
  }),

  brand_logos: (c) => ({
    heading: c.title,
    brands: (c.brands ?? []).map((b) => ({
      name: b.name,
      ...(b.logo_url ? { logo: { src: b.logo_url, alt: b.name ?? '' } } : {}),
    })),
  }),

  why_choose_us: (c) => ({
    heading: c.title,
    reasons: (c.reasons ?? []).map((r) => ({
      icon: r.icon,
      title: r.title,
      description: r.description,
    })),
  }),

  hero: (c) => ({
    heading: c.headline,
    subheading: c.subheadline,
    ...(c.background_image
      ? { image: { src: c.background_image, alt: c.headline ?? '' } }
      : {}),
    ...(c.cta_label
      ? {
          primaryCta: {
            label: c.cta_label,
            href: c.cta_phone ? `tel:${String(c.cta_phone).replace(/[^+\d]/g, '')}` : '#contact',
          },
        }
      : {}),
  }),

  services_grid: (c) => ({
    heading: c.title,
    services: (c.services ?? []).map((s) => ({
      title: s.name,
      description: s.description,
      icon: s.icon,
      // Added by migration 0004; ServicesGrid does not render these yet.
      ...(s.image_url ? { image: { src: s.image_url, alt: s.name ?? '' } } : {}),
      price: s.price,
    })),
  }),

  pricing_offers: (c) => ({
    heading: c.title,
    offers: (c.offers ?? []).map((o) => ({
      name: o.label,
      price: o.price,
      priceNote: o.note,
    })),
  }),

  gallery: (c) => ({
    heading: c.title,
    items: (c.images ?? []).map((img) => ({
      before: { src: img.before_url, alt: img.caption ? `${img.caption} — before` : 'Before' },
      after: { src: img.after_url, alt: img.caption ? `${img.caption} — after` : 'After' },
      caption: img.caption,
    })),
  }),

  testimonials: (c) => ({
    heading: c.title,
    items: (c.reviews ?? []).map((r) => ({
      quote: r.quote,
      author: r.author,
      rating: r.rating,
      // Added by migration 0004; maps onto the avatar the component already has.
      ...(r.photo_url ? { avatar: { src: r.photo_url, alt: r.author ?? '' } } : {}),
    })),
  }),

  contact: (c) => ({
    heading: c.title,
    address: c.address,
    phone: c.phone,
    // Stored as a free-text string; the component accepts both.
    hours: c.hours,
    mapEmbedUrl: c.map_embed_url,
  }),
};

function mapContent(key, content) {
  const mapper = CONTENT_MAPPERS[key];
  if (!mapper) fail(`No content mapper for block key "${key}" — add one to CONTENT_MAPPERS`);

  // Drop keys the mapper left undefined so the JSON stays readable.
  return Object.fromEntries(
    Object.entries(mapper(content ?? {})).filter(([, value]) => value !== undefined),
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

  // --- Archetype (theme defaults only) --------------------------------------

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

  // Always block_instances, never archetype_blocks. The archetype supplies a
  // site's *starting* composition (copied into block_instances once, by
  // migration), but the rendered site is whatever its own instances say — that
  // is the only table the admin portal writes to. Reading the archetype at
  // build time would silently discard every edit made through the portal.
  const { data: instanceRows, error: instanceError } = await supabase
    .from('block_instances')
    .select('position, content, content_draft, settings, block_definitions(key, name)')
    .eq('site_id', site.id)
    .order('position', { ascending: true });

  if (instanceError) fail(`Could not load block instances: ${instanceError.message}`);

  // An empty result means the site was never backfilled. Exporting zero blocks
  // would build a blank page and report success, so refuse instead.
  if (instanceRows.length === 0) {
    fail(
      `Site ${siteId} has no rows in block_instances — nothing to render. ` +
        'A site created from an archetype needs its composition copied into ' +
        'block_instances first (see supabase/migrations/0005_backfill_block_instances.sql).',
    );
  }

  const blocks = instanceRows.map((row) => ({
    type: row.block_definitions?.key,
    // --draft previews unpublished edits; a null draft falls back to published.
    content: mapContent(
      row.block_definitions?.key,
      (draft ? (row.content_draft ?? row.content) : row.content) ?? {},
    ),
    ...(row.settings && Object.keys(row.settings).length > 0
      ? { settings: row.settings }
      : {}),
  }));

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
