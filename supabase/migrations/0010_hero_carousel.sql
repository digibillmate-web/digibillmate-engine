-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0010: hero carousel slides
--
-- The reference auto-service sites lead with a rotating banner
-- (previous/next controls, several promotional images), not a single
-- static picture. A one-image hero is what makes our build read as a
-- template rather than as the client's own site.
--
-- `slides` is additive: existing content keeps working, because the
-- component falls back to background_image when no slides are set.
-- That means this migration can be run before or after the code
-- deploy without breaking the live site either way.
--
-- Run in the Supabase SQL Editor AFTER 0001-0009.
-- ============================================================

begin;

update block_definitions set
  description = 'Top-of-page banner. Rotating slides when several images are set, a single image otherwise.',
  schema = '{
    "type": "object",
    "properties": {
      "headline":    { "type": "string" },
      "subheadline": { "type": "string" },
      "cta_label":   { "type": "string" },
      "cta_phone":   { "type": "string" },
      "background_image": { "type": "string" },
      "slides": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "image_url": { "type": "string" },
            "alt":       { "type": "string" },
            "link_url":  { "type": "string" }
          },
          "required": ["image_url"]
        }
      }
    },
    "required": ["headline", "cta_label"]
  }'::jsonb,
  client_editable_fields = array['headline','subheadline','cta_label','cta_phone','slides']
where key = 'hero';

commit;

-- ------------------------------------------------------------
-- Verify — expect the slides property to be present:
--
-- select jsonb_pretty(schema) from block_definitions where key = 'hero';
--
-- Existing hero content is untouched and still valid:
--
-- select bi.content -> 'background_image' as image,
--        bi.content -> 'slides'           as slides
-- from block_instances bi
-- join block_definitions bd on bd.id = bi.block_definition_id
-- where bd.key = 'hero';
-- ------------------------------------------------------------
