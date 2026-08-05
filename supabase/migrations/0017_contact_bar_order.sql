-- floating_contact_bar: let an operator set the order of the rail.
--
-- The order was compiled in, so changing which channel a visitor reaches for
-- first meant a code change. Contact channels now lead by default (call,
-- whatsapp) with social profiles below, and the list is editable.
--
-- Each entry is a closed set, so the admin renders a picker rather than a
-- text box where a typo would drop a channel out of the order silently.
--
-- Additive: an absent or empty list keeps the default order.

update block_definitions
set
  schema = jsonb_set(
    schema,
    '{properties,order}',
    '{
       "type": "array",
       "items": {
         "type": "string",
         "enum": ["call", "whatsapp", "instagram", "facebook", "youtube"]
       }
     }'::jsonb,
    true
  ),
  -- Appended, because this list doubles as the field display order in the
  -- admin form and the existing entries must keep their positions.
  client_editable_fields = client_editable_fields || array['order']
where key = 'floating_contact_bar'
  and not (schema -> 'properties' ? 'order');
