-- ============================================================
-- DigiBillMate Website Builder Engine
-- Seed: Auto Service & Repair archetype, based on Maria Cars
-- Run this in Supabase SQL Editor AFTER 0001 and 0002.
-- ============================================================

-- ------------------------------------------------------------
-- 1. BLOCK DEFINITIONS (the 6 Maria Cars blocks)
-- ------------------------------------------------------------
insert into block_definitions (key, name, description, schema, client_editable_fields) values

('hero', 'Hero Banner',
 'Top-of-page headline with primary call-to-action.',
 '{
   "type": "object",
   "properties": {
     "headline":    { "type": "string" },
     "subheadline": { "type": "string" },
     "cta_label":   { "type": "string" },
     "cta_phone":   { "type": "string" },
     "background_image": { "type": "string" }
   },
   "required": ["headline", "cta_label"]
 }'::jsonb,
 array['headline','subheadline','cta_label','cta_phone']
),

('services_grid', 'Services Grid',
 'List/grid of services offered.',
 '{
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
           "icon":        { "type": "string" }
         },
         "required": ["name"]
       }
     }
   },
   "required": ["services"]
 }'::jsonb,
 array['title','services']
),

('pricing_offers', 'Pricing / Offers',
 'Flat-rate pricing per service, trust-building for local customers.',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string" },
     "offers": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "label": { "type": "string" },
           "price": { "type": "string" },
           "note":  { "type": "string" }
         },
         "required": ["label", "price"]
       }
     }
   },
   "required": ["offers"]
 }'::jsonb,
 array['title','offers']
),

('gallery', 'Before/After Gallery',
 'Photo proof of work quality.',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string" },
     "images": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "before_url": { "type": "string" },
           "after_url":  { "type": "string" },
           "caption":    { "type": "string" }
         }
       }
     }
   },
   "required": ["images"]
 }'::jsonb,
 array['title','images']
),

('testimonials', 'Testimonials',
 'Customer quotes / reviews.',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string" },
     "reviews": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "quote":  { "type": "string" },
           "author": { "type": "string" },
           "rating": { "type": "number" }
         },
         "required": ["quote"]
       }
     }
   },
   "required": ["reviews"]
 }'::jsonb,
 array['title','reviews']
),

('contact', 'Contact / Location',
 'Address, phone, hours, map.',
 '{
   "type": "object",
   "properties": {
     "title":      { "type": "string" },
     "address":    { "type": "string" },
     "phone":      { "type": "string" },
     "hours":      { "type": "string" },
     "map_embed_url": { "type": "string" }
   },
   "required": ["address", "phone"]
 }'::jsonb,
 array['title','address','phone','hours']
);

-- ------------------------------------------------------------
-- 2. ARCHETYPE: Auto Service & Repair
-- ------------------------------------------------------------
insert into archetypes (key, name, description, default_theme) values
('auto_service_repair', 'Auto Service & Repair',
 'Local auto body/repair shops. Reference: Maria Cars, Chennai.',
 '{
   "color-primary":    "#c0392b",
   "color-secondary":  "#1a1a1a",
   "color-background": "#ffffff",
   "color-text":       "#222222",
   "font-heading":     "Poppins, sans-serif",
   "font-body":        "Inter, sans-serif"
 }'::jsonb
);

-- ------------------------------------------------------------
-- 3. ARCHETYPE_BLOCKS (default composition + starter content)
-- ------------------------------------------------------------
insert into archetype_blocks (archetype_id, block_definition_id, position, default_content)
select
  (select id from archetypes where key = 'auto_service_repair'),
  bd.id,
  ordering.position,
  ordering.default_content
from (values
  ('hero', 1, '{
      "headline": "Your Car, Fixed Right.",
      "subheadline": "Multi-brand dent removal, painting, and rust treatment.",
      "cta_label": "Call Now",
      "cta_phone": "+91 90000 00000"
    }'::jsonb),
  ('services_grid', 2, '{
      "title": "Our Services",
      "services": [
        {"name": "Dent Removal", "description": "Panel-by-panel dent and scratch removal."},
        {"name": "Full Body Painting", "description": "OEM-matched paint, showroom finish."},
        {"name": "Bumper Repair", "description": "Restore strength, alignment, and look."},
        {"name": "Rust Removal", "description": "Treat and protect against further damage."},
        {"name": "Ceramic Coating", "description": "Multi-layer protection against dirt and fade."}
      ]
    }'::jsonb),
  ('pricing_offers', 3, '{
      "title": "Flat, Honest Pricing",
      "offers": [
        {"label": "Dent & Scratch (per panel)", "price": "2,499"},
        {"label": "Full Body Painting", "price": "24,999", "note": "Includes rubbing polish"}
      ]
    }'::jsonb),
  ('gallery', 4, '{
      "title": "See The Difference",
      "images": []
    }'::jsonb),
  ('testimonials', 5, '{
      "title": "What Our Customers Say",
      "reviews": []
    }'::jsonb),
  ('contact', 6, '{
      "title": "Visit Us",
      "address": "",
      "phone": "",
      "hours": "Monday–Saturday, 9:00 AM–7:00 PM"
    }'::jsonb)
) as ordering(block_key, position, default_content)
join block_definitions bd on bd.key = ordering.block_key;

-- ------------------------------------------------------------
-- 4. ONE REAL CLIENT + SITE (linked to archetype, for testing)
-- ------------------------------------------------------------
insert into clients (name, business_type, contact_name, contact_phone) values
('Maria Cars', 'auto_service', 'Vinoth Kumar', '+91 99626 77030');

insert into sites (client_id, archetype_id, name, subdomain, theme, composition_linked, theme_linked, status)
select
  (select id from clients where name = 'Maria Cars'),
  (select id from archetypes where key = 'auto_service_repair'),
  'Maria Cars - Guindy',
  'mariacars',
  '{}'::jsonb,   -- empty: theme_linked=true means it inherits archetype default_theme entirely
  true,          -- composition_linked: pulls blocks from archetype_blocks
  true,          -- theme_linked: pulls theme from archetype default_theme
  'draft';

-- Confirm the seed worked:
-- select id, subdomain from sites where subdomain = 'mariacars';
-- (use that id to run: npm run export:site -- <site_id>)
