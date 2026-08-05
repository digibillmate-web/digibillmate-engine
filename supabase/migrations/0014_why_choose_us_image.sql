-- why_choose_us: optional image shown between the two columns of reasons.
--
-- The reference layout sets its reasons either side of a photograph rather
-- than in a row of cards, and without somewhere to store that image the
-- section can only ever be a list.
--
-- Additive: the field is optional, so existing instances keep rendering as a
-- single column until an image is uploaded.

update block_definitions
set
  schema = jsonb_set(
    jsonb_set(
      schema,
      '{properties,image_url}',
      '{"type": "string"}'::jsonb,
      true
    ),
    '{properties,image_alt}',
    '{"type": "string"}'::jsonb,
    true
  ),
  -- Appended rather than rebuilt: this list is also the field display order
  -- in the admin form, so the existing entries must keep their positions.
  client_editable_fields = client_editable_fields || array['image_url', 'image_alt']
where key = 'why_choose_us'
  and not (schema -> 'properties' ? 'image_url');
