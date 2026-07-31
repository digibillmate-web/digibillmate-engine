-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0004: Expand the Auto Service & Repair archetype
--
-- Adds 6 new block definitions, upgrades the schema of 2 existing
-- ones, and rebuilds the archetype composition to 11 blocks.
--
-- Run in the Supabase SQL Editor AFTER 0001-0003.
-- Does NOT modify any table structure — block_definitions.schema is
-- a jsonb column, so a schema change is an UPDATE of that value.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. NEW BLOCK DEFINITIONS
--
-- Inserts are idempotent: re-running updates the existing row
-- rather than failing on the unique key.
-- ------------------------------------------------------------

insert into block_definitions (key, name, description, schema, client_editable_fields) values

('header_nav', 'Header / Navigation',
 'Sticky top bar: logo, nav links, phone, and a primary call-to-action.',
 '{
   "type": "object",
   "properties": {
     "logo_url":      { "type": "string" },
     "logo_alt":      { "type": "string" },
     "business_name": { "type": "string" },
     "nav_links": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "label": { "type": "string" },
           "href":  { "type": "string" }
         },
         "required": ["label", "href"]
       }
     },
     "phone":     { "type": "string" },
     "cta_label": { "type": "string" },
     "cta_href":  { "type": "string" }
   },
   "required": ["business_name"]
 }'::jsonb,
 array['business_name','phone','cta_label','cta_href','nav_links']
),

('floating_contact_bar', 'Floating Contact Bar',
 'Fixed-position contact icons. Every channel is optional — omit the key and the icon is not rendered.',
 '{
   "type": "object",
   "properties": {
     "call":      { "type": "object", "properties": { "label": { "type": "string" }, "url": { "type": "string" } } },
     "whatsapp":  { "type": "object", "properties": { "label": { "type": "string" }, "url": { "type": "string" } } },
     "facebook":  { "type": "object", "properties": { "label": { "type": "string" }, "url": { "type": "string" } } },
     "instagram": { "type": "object", "properties": { "label": { "type": "string" }, "url": { "type": "string" } } },
     "youtube":   { "type": "object", "properties": { "label": { "type": "string" }, "url": { "type": "string" } } }
   }
 }'::jsonb,
 array['call','whatsapp','facebook','instagram','youtube']
),

('about_section', 'About Section',
 'Photo-and-text introduction to the business.',
 '{
   "type": "object",
   "properties": {
     "heading":         { "type": "string" },
     "body":            { "type": "string" },
     "image_url":       { "type": "string" },
     "image_alt":       { "type": "string" },
     "read_more_label": { "type": "string" },
     "read_more_href":  { "type": "string" }
   },
   "required": ["heading", "body"]
 }'::jsonb,
 array['heading','body','read_more_label','read_more_href']
),

('brand_logos', 'Brand Logos',
 'Strip of brands serviced or partnered with.',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string" },
     "brands": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "name":     { "type": "string" },
           "logo_url": { "type": "string" }
         },
         "required": ["name"]
       }
     }
   },
   "required": ["brands"]
 }'::jsonb,
 array['title','brands']
),

('why_choose_us', 'Why Choose Us',
 'Icon-led trust points, typically four.',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string" },
     "reasons": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "icon":        { "type": "string" },
           "title":       { "type": "string" },
           "description": { "type": "string" }
         },
         "required": ["title"]
       }
     }
   },
   "required": ["reasons"]
 }'::jsonb,
 array['title','reasons']
),

('footer', 'Footer',
 'Site footer: services, quick links, contact details, optional QR code, copyright.',
 '{
   "type": "object",
   "properties": {
     "business_name": { "type": "string" },
     "tagline":       { "type": "string" },
     "services_title": { "type": "string" },
     "services": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "label": { "type": "string" },
           "href":  { "type": "string" }
         },
         "required": ["label"]
       }
     },
     "quick_links_title": { "type": "string" },
     "quick_links": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "label": { "type": "string" },
           "href":  { "type": "string" }
         },
         "required": ["label"]
       }
     },
     "contact_title": { "type": "string" },
     "contact": {
       "type": "object",
       "properties": {
         "phone":   { "type": "string" },
         "email":   { "type": "string" },
         "address": { "type": "string" }
       }
     },
     "qr_image_url": { "type": "string" },
     "qr_caption":   { "type": "string" },
     "copyright":    { "type": "string" }
   }
 }'::jsonb,
 array['services','quick_links','contact','copyright','tagline']
)

on conflict (key) do update set
  name                  = excluded.name,
  description           = excluded.description,
  schema                = excluded.schema,
  client_editable_fields = excluded.client_editable_fields;

-- ------------------------------------------------------------
-- 2. UPGRADE EXISTING BLOCK SCHEMAS
--
-- services_grid: each service gains image_url + price
-- testimonials:  each review gains photo_url
--
-- Additive only: existing stored content stays valid, the new keys
-- are simply absent until filled in.
-- ------------------------------------------------------------

update block_definitions set
  description = 'Grid of services offered, each with a photo and price.',
  schema = '{
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "services": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name":        { "type": "string" },
            "description": { "type": "string" },
            "icon":        { "type": "string" },
            "image_url":   { "type": "string" },
            "price":       { "type": "string" }
          },
          "required": ["name"]
        }
      }
    },
    "required": ["services"]
  }'::jsonb
where key = 'services_grid';

update block_definitions set
  description = 'Customer quotes with optional reviewer photo.',
  schema = '{
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "reviews": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "quote":     { "type": "string" },
            "author":    { "type": "string" },
            "rating":    { "type": "number" },
            "photo_url": { "type": "string" }
          },
          "required": ["quote"]
        }
      }
    },
    "required": ["reviews"]
  }'::jsonb
where key = 'testimonials';

-- ------------------------------------------------------------
-- 3. REBUILD THE ARCHETYPE COMPOSITION
--
-- archetype_blocks has `unique (archetype_id, position)`, so the
-- existing rows at positions 1-6 cannot be renumbered in place
-- without transient collisions. Deleting and re-inserting the whole
-- composition in one transaction is the clean way to reorder.
--
-- Safe because archetype_blocks holds only default/starter content:
-- per-site content lives in block_instances and is untouched. All
-- existing default_content is restated below, upgraded where the
-- schema changed.
-- ------------------------------------------------------------

delete from archetype_blocks
where archetype_id = (select id from archetypes where key = 'auto_service_repair');

insert into archetype_blocks (archetype_id, block_definition_id, position, default_content)
select
  (select id from archetypes where key = 'auto_service_repair'),
  bd.id,
  ordering.position,
  ordering.default_content
from (values

  ('floating_contact_bar', 1, '{
      "call":      {"label": "Call",      "url": "tel:+919000000000"},
      "whatsapp":  {"label": "WhatsApp",  "url": "https://wa.me/919000000000"},
      "facebook":  {"label": "Facebook",  "url": "https://facebook.com/"},
      "instagram": {"label": "Instagram", "url": "https://instagram.com/"},
      "youtube":   {"label": "YouTube",   "url": "https://youtube.com/"}
    }'::jsonb),

  ('header_nav', 2, '{
      "business_name": "Maria Cars",
      "logo_url": "/placeholders/logo.svg",
      "logo_alt": "Maria Cars",
      "nav_links": [
        {"label": "Home",        "href": "#top"},
        {"label": "About",       "href": "#about"},
        {"label": "Services",    "href": "#services"},
        {"label": "Gallery",     "href": "#gallery"},
        {"label": "Testimonials","href": "#testimonials"},
        {"label": "Contact",     "href": "#contact"}
      ],
      "phone": "+91 90000 00000",
      "cta_label": "Book a Service",
      "cta_href": "#contact"
    }'::jsonb),

  ('hero', 3, '{
      "headline": "Your Car, Fixed Right.",
      "subheadline": "Multi-brand dent removal, painting, and rust treatment.",
      "cta_label": "Call Now",
      "cta_phone": "+91 90000 00000",
      "background_image": "/placeholders/hero.svg"
    }'::jsonb),

  ('about_section', 4, '{
      "heading": "Chennai''s Trusted Multi-Brand Body Shop",
      "body": "For over a decade we have restored cars of every make to showroom condition. Our workshop combines OEM-matched paint, modern dent-removal equipment, and technicians who explain the work before they start it.",
      "image_url": "/placeholders/about.svg",
      "image_alt": "Technicians working in the Maria Cars workshop",
      "read_more_label": "More about us",
      "read_more_href": "#contact"
    }'::jsonb),

  ('services_grid', 5, '{
      "title": "Our Services",
      "services": [
        {"name": "Dent Removal",       "description": "Panel-by-panel dent and scratch removal.",        "image_url": "/placeholders/service.svg", "price": "2,499"},
        {"name": "Full Body Painting", "description": "OEM-matched paint, showroom finish.",             "image_url": "/placeholders/service.svg", "price": "24,999"},
        {"name": "Bumper Repair",      "description": "Restore strength, alignment, and look.",          "image_url": "/placeholders/service.svg", "price": "3,499"},
        {"name": "Rust Removal",       "description": "Treat and protect against further damage.",       "image_url": "/placeholders/service.svg", "price": "4,999"},
        {"name": "Ceramic Coating",    "description": "Multi-layer protection against dirt and fade.",   "image_url": "/placeholders/service.svg", "price": "14,999"}
      ]
    }'::jsonb),

  ('brand_logos', 6, '{
      "title": "Brands We Service",
      "brands": [
        {"name": "Maruti Suzuki", "logo_url": "/placeholders/brand.svg"},
        {"name": "Hyundai",       "logo_url": "/placeholders/brand.svg"},
        {"name": "Tata",          "logo_url": "/placeholders/brand.svg"},
        {"name": "Mahindra",      "logo_url": "/placeholders/brand.svg"},
        {"name": "Honda",         "logo_url": "/placeholders/brand.svg"},
        {"name": "Toyota",        "logo_url": "/placeholders/brand.svg"}
      ]
    }'::jsonb),

  ('why_choose_us', 7, '{
      "title": "Why Choose Us",
      "reasons": [
        {"icon": "shield",  "title": "2-Year Warranty",     "description": "Every paint and panel job is warranted for two full years."},
        {"icon": "clock",   "title": "On-Time Delivery",    "description": "We commit to a date up front and keep to it."},
        {"icon": "rupee",   "title": "Transparent Pricing", "description": "Written estimate before work starts. No surprises."},
        {"icon": "wrench",  "title": "Expert Technicians",  "description": "Factory-trained staff across all major brands."}
      ]
    }'::jsonb),

  ('gallery', 8, '{
      "title": "See The Difference",
      "images": [
        {"before_url": "/placeholders/before.svg", "after_url": "/placeholders/after.svg", "caption": "Front bumper respray"},
        {"before_url": "/placeholders/before.svg", "after_url": "/placeholders/after.svg", "caption": "Rear quarter panel dent removal"},
        {"before_url": "/placeholders/before.svg", "after_url": "/placeholders/after.svg", "caption": "Full body repaint"}
      ]
    }'::jsonb),

  ('testimonials', 9, '{
      "title": "What Our Customers Say",
      "reviews": [
        {"quote": "Quoted me half what the dealership wanted and finished a day early.", "author": "Daniel R.", "rating": 5, "photo_url": "/placeholders/avatar.svg"},
        {"quote": "Clear explanation of what was wrong, no upselling. Back on the road by lunchtime.", "author": "Priya S.", "rating": 5, "photo_url": "/placeholders/avatar.svg"},
        {"quote": "The bodywork is invisible — you cannot tell the car was ever hit.", "author": "Marcus T.", "rating": 4, "photo_url": "/placeholders/avatar.svg"}
      ]
    }'::jsonb),

  ('contact', 10, '{
      "title": "Visit Us",
      "address": "",
      "phone": "",
      "hours": "Monday–Saturday, 9:00 AM–7:00 PM"
    }'::jsonb),

  ('footer', 11, '{
      "business_name": "Maria Cars",
      "tagline": "Multi-brand car body repair and painting in Chennai.",
      "services_title": "Services",
      "services": [
        {"label": "Dent Removal",       "href": "#services"},
        {"label": "Full Body Painting", "href": "#services"},
        {"label": "Bumper Repair",      "href": "#services"},
        {"label": "Rust Removal",       "href": "#services"},
        {"label": "Ceramic Coating",    "href": "#services"}
      ],
      "quick_links_title": "Quick Links",
      "quick_links": [
        {"label": "About",        "href": "#about"},
        {"label": "Gallery",      "href": "#gallery"},
        {"label": "Testimonials", "href": "#testimonials"},
        {"label": "Contact",      "href": "#contact"}
      ],
      "contact_title": "Get In Touch",
      "contact": {
        "phone": "+91 90000 00000",
        "email": "hello@mariacars.co.in",
        "address": "Guindy, Chennai, Tamil Nadu"
      },
      "qr_image_url": "/placeholders/qr.svg",
      "qr_caption": "Scan to save our contact",
      "copyright": "© 2026 Maria Cars. All rights reserved."
    }'::jsonb)

) as ordering(block_key, position, default_content)
join block_definitions bd on bd.key = ordering.block_key;

commit;

-- ------------------------------------------------------------
-- Verify:
--
-- select ab.position, bd.key
-- from archetype_blocks ab
-- join block_definitions bd on bd.id = ab.block_definition_id
-- join archetypes a on a.id = ab.archetype_id
-- where a.key = 'auto_service_repair'
-- order by ab.position;
--
-- Expect 11 rows:
--   1 floating_contact_bar   7 why_choose_us
--   2 header_nav             8 gallery
--   3 hero                   9 testimonials
--   4 about_section         10 contact
--   5 services_grid         11 footer
--   6 brand_logos
-- ------------------------------------------------------------
