-- about_section: height for the full-width highlight band.
--
-- An about_section carrying an image and no text renders as the full-width
-- band above the footer. Its height was fixed in CSS, so the only way to
-- change it was a code change.
--
-- A closed set rather than a number: an arbitrary pixel value invites a band
-- taller than the viewport, and these three cover the difference between a
-- divider and a feature.
--
-- Additive: absent behaves as 'medium', which is the height it renders at now.

update block_definitions
set
  schema = jsonb_set(
    schema,
    '{properties,band_height}',
    '{"type": "string", "enum": ["short", "medium", "tall", "full"]}'::jsonb,
    true
  ),
  -- Appended, because this list doubles as the field display order in the
  -- admin form and the existing entries must keep their positions.
  client_editable_fields = client_editable_fields || array['band_height']
where key = 'about_section'
  and not (schema -> 'properties' ? 'band_height');
