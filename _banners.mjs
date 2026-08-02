import { createClient } from '@supabase/supabase-js';

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SITE = '70f131fe-8b09-42f9-8682-8d8dfcebafe1';

const { data: definition } = await s
  .from('block_definitions')
  .select('id')
  .eq('key', 'page_banner')
  .maybeSingle();

if (!definition) {
  console.error('page_banner block definition missing — run migration 0013 first.');
  process.exit(1);
}

const { data: pages } = await s
  .from('site_pages')
  .select('id, slug, title')
  .eq('site_id', SITE)
  .order('position');

const { data: blocks } = await s
  .from('block_instances')
  .select('id, page_id, position, content, block_definitions(key)')
  .eq('site_id', SITE)
  .order('position');

const keyOf = (b) => b.block_definitions.key;

// A photo already uploaded on the site beats a placeholder for the banner.
const heroBlock = blocks.find((b) => keyOf(b) === 'hero');
const bannerImage =
  heroBlock?.content?.slides?.[0]?.image_url || heroBlock?.content?.background_image || '';

console.log('banner image source:', bannerImage ? bannerImage.slice(-40) : '(none)');

// ---------------------------------------------------------------------------
// 1. Contact and Enquiry were the same page in practice: /contact carried the
//    enquiry form as well, so both routes showed it. Give each page one job.
// ---------------------------------------------------------------------------
const contactPage = pages.find((p) => p.slug === 'contact');
const strayForm = blocks.find(
  (b) => b.page_id === contactPage?.id && keyOf(b) === 'enquiry_form',
);

if (strayForm) {
  await s.from('block_instances').delete().eq('id', strayForm.id);
  console.log('removed the duplicate enquiry form from /contact');
} else {
  console.log('/contact has no stray enquiry form');
}

// ---------------------------------------------------------------------------
// 2. A banner at the top of every inner page. Home keeps its hero instead.
// ---------------------------------------------------------------------------
const SUBTITLES = {
  about: 'Who we are and how we work',
  services: 'What we do, and what it costs',
  gallery: 'Before and after, from our workshop',
  contact: 'Where to find us and how to reach us',
  enquiry: 'Tell us what your car needs',
};

for (const page of pages) {
  const slug = page.slug ?? '';
  if (slug === '') continue;

  const existing = blocks.find((b) => b.page_id === page.id && keyOf(b) === 'page_banner');
  if (existing) {
    console.log(`  /${slug} already has a banner`);
    continue;
  }

  // Park the existing blocks below, then insert the banner at position 1.
  const mine = blocks
    .filter((b) => b.page_id === page.id)
    .sort((a, b) => a.position - b.position);

  for (const [i, block] of mine.entries()) {
    await s.from('block_instances').update({ position: 500 + i }).eq('id', block.id);
  }

  const { error } = await s.from('block_instances').insert({
    site_id: SITE,
    page_id: page.id,
    block_definition_id: definition.id,
    position: 1,
    content: {
      // Left blank on purpose: the renderer fills it from the page title, so
      // renaming the page cannot leave a stale banner behind.
      title: '',
      subtitle: SUBTITLES[slug] ?? '',
      background_image: bannerImage,
      show_breadcrumb: true,
    },
  });

  if (error) {
    console.log(`  ! /${slug}: ${error.message}`);
    continue;
  }

  for (const [i, block] of mine.entries()) {
    await s.from('block_instances').update({ position: i + 2 }).eq('id', block.id);
  }

  console.log(`  /${slug} -> banner added at position 1`);
}

// ---------------------------------------------------------------------------
const { data: finalPages } = await s
  .from('site_pages')
  .select('id, slug')
  .eq('site_id', SITE)
  .order('position');
const { data: finalBlocks } = await s
  .from('block_instances')
  .select('page_id, position, block_definitions(key)')
  .eq('site_id', SITE)
  .order('position');

console.log('\nFINAL');
for (const p of finalPages) {
  const mine = finalBlocks
    .filter((b) => b.page_id === p.id)
    .sort((a, b) => a.position - b.position);
  console.log(`  /${(p.slug || '(home)').padEnd(9)} ${mine.map((b) => b.block_definitions.key).join(', ')}`);
}
