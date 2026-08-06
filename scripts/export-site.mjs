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
/**
 * Turns whatever someone pasted into a URL Google will actually render.
 *
 * Google only frames its own embed URLs, and refuses everything else without
 * a word — the iframe just stays blank. What people paste is the Share link
 * (maps.app.goo.gl/...), because that is what Google's Share button gives
 * them, so treating that as user error would mean the field is unusable.
 *
 * A short link is resolved here rather than in the browser: it redirects to a
 * place URL carrying coordinates, and following it needs a server. Done at
 * export time it costs one request per build and nothing at page load.
 *
 * Fails soft on purpose. A build should not break because a maps redirect
 * timed out, so an unresolved link is passed through and the renderer falls
 * back to a query built from the address.
 */
const mapUrlCache = new Map();

async function resolveMapUrl(raw) {
  let url = raw?.trim();
  if (!url) return undefined;

  /*
   * Google's "Embed a map" tab hands over a whole <iframe> element, not a
   * URL, so that is what lands in the field. Take the src rather than
   * rejecting it — the alternative is telling someone their correct answer
   * is wrong because of the wrapper it arrived in.
   */
  const iframeSrc = url.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (iframeSrc) url = iframeSrc[1];

  // Already embeddable — leave it alone.
  if (/\/maps\/embed|output=embed/.test(url)) return url;
  if (mapUrlCache.has(url)) return mapUrlCache.get(url);

  let resolved = url;

  if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/.test(url)) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      resolved = response.url || url;
    } catch (error) {
      console.warn(`  ! could not resolve map link (${error.message}) — using it as-is`);
      mapUrlCache.set(url, url);
      return url;
    }
  }

  /*
   * A place URL carries two coordinate pairs: the @lat,lng viewport centre
   * and a !3d/!4d pair that is the place itself. The place is what should be
   * pinned — the viewport centre can sit a street or two away.
   */
  const place = resolved.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const centre = resolved.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const point = place ?? centre;

  const embed = point
    ? `https://www.google.com/maps?q=${point[1]},${point[2]}&output=embed`
    : url;

  mapUrlCache.set(url, embed);
  return embed;
}

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
      ...(Array.isArray(c.order) && c.order.length > 0 ? { order: c.order } : {}),
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
    ...(c.band_height ? { bandHeight: c.band_height } : {}),
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
    ...(c.image_url ? { image: { src: c.image_url, alt: c.image_alt ?? '' } } : {}),
  }),

  hero: (c) => ({
    heading: c.headline,
    subheading: c.subheadline,
    ...(c.background_image
      ? { image: { src: c.background_image, alt: c.headline ?? '' } }
      : {}),
    // Slides added by migration 0010. Entries without an image_url are
    // dropped rather than rendered as a blank slide — an operator who added
    // a row and has not uploaded to it yet should not get a gap in the
    // rotation.
    ...(Array.isArray(c.slides) && c.slides.some((s) => s?.image_url)
      ? {
          slides: c.slides
            .filter((s) => s?.image_url)
            .map((s) => ({
              image: { src: s.image_url, alt: s.alt ?? c.headline ?? '' },
              ...(s.link_url ? { link: s.link_url } : {}),
            })),
        }
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
    ...(c.layout === 'detail' ? { layout: 'detail' } : {}),
    services: (c.services ?? []).map((s) => ({
      title: s.name,
      description: s.description,
      icon: s.icon,
      // Added by migration 0004; ServicesGrid does not render these yet.
      ...(s.image_url ? { image: { src: s.image_url, alt: s.name ?? '' } } : {}),
      price: s.price,
    })),
  }),

  work_process: (c) => ({
    title: c.title,
    intro: c.intro,
    steps: (c.steps ?? []).map((step) => ({
      title: step.title,
      description: step.description,
      icon: step.icon,
    })),
  }),

  category_list: (c) => ({
    title: c.title,
    intro: c.intro,
    categories: (c.categories ?? []).map((category) => ({
      title: category.title,
      icon: category.icon,
      ...(category.image_url
        ? { image: { src: category.image_url, alt: category.title ?? '' } }
        : {}),
      items: (category.items ?? []).map((item) => ({
        label: item.label,
        note: item.note,
      })),
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

  page_banner: (c) => ({
    title: c.title ?? '',
    subtitle: c.subtitle,
    ...(c.background_image
      ? { image: { src: c.background_image, alt: c.title ?? '' } }
      : {}),
    showBreadcrumb: c.show_breadcrumb !== false,
  }),

  enquiry_form: (c) => ({
    title: c.title,
    intro: c.intro,
    whatsappNumber: c.whatsapp_number,
    email: c.email,
    submitLabel: c.submit_label,
    // Blank rows are dropped rather than rendered as an empty option.
    serviceOptions: (c.service_options ?? [])
      .map((option) => String(option).trim())
      .filter(Boolean),
    footnote: c.footnote,
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

  // --- Pages ----------------------------------------------------------------

  const { data: pageRows, error: pageError } = await supabase
    .from('site_pages')
    .select(
      'id, slug, title, nav_label, position, show_in_nav, theme_overrides, reveal_animation',
    )
    .eq('site_id', site.id)
    .order('position', { ascending: true });

  if (pageError) {
    // Naming the migration here because the raw PostgREST message ("column
    // site_pages.theme_overrides does not exist") tells you what is wrong but
    // not what to do about it.
    const missingColumn = /column .* does not exist/i.test(pageError.message);
    fail(
      `Could not load site pages: ${pageError.message}` +
        (missingColumn
          ? '\n  A migration has not been applied — see supabase/migrations/ ' +
            'and run any files newer than your database.'
          : ''),
    );
  }

  if (!pageRows || pageRows.length === 0) {
    fail(
      `Site ${siteId} has no rows in site_pages — nothing to render. ` +
        'Every site needs at least a home page (see ' +
        'supabase/migrations/0011_site_pages.sql).',
    );
  }

  // --- Blocks ---------------------------------------------------------------

  // Always block_instances, never archetype_blocks. The archetype supplies a
  // site's *starting* composition (copied into block_instances once, by
  // migration), but the rendered site is whatever its own instances say — that
  // is the only table the admin portal writes to. Reading the archetype at
  // build time would silently discard every edit made through the portal.
  // is_hidden blocks keep their content and position but are left out of the
  // built site — that is the whole difference between hiding and deleting.
  const { data: instanceRows, error: instanceError } = await supabase
    .from('block_instances')
    .select('page_id, position, content, content_draft, settings, block_definitions(key, name)')
    .eq('site_id', site.id)
    .eq('is_hidden', false)
    .order('position', { ascending: true });

  if (instanceError) fail(`Could not load block instances: ${instanceError.message}`);

  const toBlock = (row) => ({
    type: row.block_definitions?.key,
    // --draft previews unpublished edits; a null draft falls back to published.
    content: mapContent(
      row.block_definitions?.key,
      (draft ? (row.content_draft ?? row.content) : row.content) ?? {},
    ),
    ...(row.settings && Object.keys(row.settings).length > 0
      ? { settings: row.settings }
      : {}),
  });

  const unresolved = (instanceRows ?? []).filter((row) => !row.block_definitions?.key);
  if (unresolved.length > 0) {
    fail(`${unresolved.length} block(s) have no block_definitions.key — check the join`);
  }

  const pages = pageRows.map((page) => {
    /*
     * Page overrides are emitted separately from the site theme rather than
     * merged into it. The renderer scopes them to the page, so the site theme
     * stays the single value every page starts from and a page's own colours
     * are visibly a delta rather than a full copy of the palette.
     */
    const overrides = toCssVars(page.theme_overrides);

    return {
      slug: page.slug ?? '',
      title: page.title,
      navLabel: page.nav_label || page.title,
      showInNav: page.show_in_nav !== false,
      ...(Object.keys(overrides).length > 0 ? { theme: overrides } : {}),
      ...(page.reveal_animation ? { revealAnimation: page.reveal_animation } : {}),
      blocks: (instanceRows ?? [])
        .filter((row) => row.page_id === page.id)
        .map(toBlock),
    };
  });

  // --- Navigation -----------------------------------------------------------

  /*
   * Resolved after mapping rather than inside the mapper, which is sync. One
   * network call per distinct link per build, cached.
   */
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.type !== 'contact' || !block.content.mapEmbedUrl) continue;
      block.content.mapEmbedUrl = await resolveMapUrl(block.content.mapEmbedUrl);
    }
  }

  /**
   * Pages are the source of truth for navigation, so a new page appears in the
   * menu without anyone editing a block. Hand-entered nav_links still win when
   * present — a site may want external or anchor links the page list cannot
   * express — so this fills the gap rather than overriding a deliberate choice.
   */
  const hrefFor = (slug) => (slug ? `/${slug}/` : '/');

  const derivedNav = pageRows
    .filter((page) => page.show_in_nav !== false)
    .map((page) => ({
      label: page.nav_label || page.title,
      href: hrefFor(page.slug ?? ''),
    }));

  // Which link is "current" is deliberately NOT decided here. A page without
  // its own header inherits the home page's, so a flag baked in at export time
  // would mark Home as current on every inherited copy. The renderer marks it,
  // where the page actually being rendered is known.
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.type === 'header_nav' && (block.content.navLinks ?? []).length === 0) {
        block.content.navLinks = derivedNav;
      }

      if (block.type === 'footer' && (block.content.quickLinks ?? []).length === 0) {
        block.content.quickLinks = derivedNav;
      }
    }
  }

  // A site whose home page has no blocks would build a blank index and report
  // success. Empty secondary pages are a legitimate work-in-progress; an empty
  // home page is not.
  const home = pages.find((page) => page.slug === '') ?? pages[0];
  if (!home || home.blocks.length === 0) {
    fail(
      `Site ${siteId} has no blocks on its home page — nothing to render. ` +
        'Add blocks to it in the admin portal, or check that block_instances ' +
        'rows carry the right page_id.',
    );
  }

  const totalBlocks = pages.reduce((sum, page) => sum + page.blocks.length, 0);

  // --- Write ----------------------------------------------------------------

  const payload = {
    id: site.id,
    subdomain: site.subdomain,
    customDomain: site.custom_domain ?? null,
    status: site.status,
    /*
     * Where the enquiry form posts. Baked in at build rather than stored per
     * site, because it is a property of the platform, not of the client — one
     * endpoint serves every site and moving it should not mean editing rows.
     *
     * Absent when unset, and the form falls back to WhatsApp alone rather
     * than posting into the void.
     */
    enquiryEndpoint: process.env.ENQUIRY_ENDPOINT?.trim() || null,
    theme,
    pages,
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
    `✔ Exported ${pages.length} page(s), ${totalBlocks} block(s) for ` +
      `"${site.subdomain ?? site.id}"${draft ? ' (draft)' : ''} → ${outPath}`,
  );

  for (const page of pages) {
    console.log(`    /${page.slug}${page.slug ? '' : ' (home)'} — ${page.blocks.length} block(s)`);
  }
}

main().catch((error) => fail(error.stack ?? String(error)));
