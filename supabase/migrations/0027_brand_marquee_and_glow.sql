-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0027: brand marquee layout
--
-- Taken from a live reference site, whose feel comes from two
-- effects the engine had no way to express:
--
--   a brands strip that scrolls continuously rather than sitting
--   still in a grid, and
--
--   large blurred colour blobs drifting slowly behind the page.
--
-- The second is a theme setting and needs no schema. This is the
-- first: a layout switch on brand_logos, the same shape as the
-- rail/detail switch already on services_grid.
--
-- Additive: absent or 'grid' renders exactly as today.
--
-- Run in the Supabase SQL Editor AFTER 0001-0026.
-- ============================================================

begin;

update block_definitions
set
  schema = jsonb_set(
    schema,
    '{properties,layout}',
    '{"type": "string", "enum": ["grid", "marquee"]}'::jsonb,
    true
  ),
  -- Appended: this list doubles as the field display order in the admin
  -- form, so existing fields must keep their positions.
  client_editable_fields = client_editable_fields || array['layout']
where key = 'brand_logos'
  and not (schema -> 'properties' ? 'layout');

commit;

-- ------------------------------------------------------------
-- Verify:
--
-- select key, schema -> 'properties' -> 'layout'
-- from block_definitions where key = 'brand_logos';
-- ------------------------------------------------------------
