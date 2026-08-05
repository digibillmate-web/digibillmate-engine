-- contact: expose the map field in the admin.
--
-- map_embed_url has always been in the schema and the export pipeline reads
-- it, but it was never listed in client_editable_fields — and that list is
-- what the admin form renders from. The field existed everywhere except the
-- one place an operator could reach, so the map could never be set and the
-- section rendered without one.
--
-- Additive: sites that already have a value keep it.

update block_definitions
set client_editable_fields = client_editable_fields || array['map_embed_url']
where key = 'contact'
  and not (client_editable_fields @> array['map_embed_url']);
