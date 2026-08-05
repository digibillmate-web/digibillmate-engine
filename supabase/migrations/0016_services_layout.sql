-- services_grid: choose between the summary rail and a full detail stack.
--
-- The services page on the reference site is not a second, separately typed
-- block — it is the same list of services shown at length, one full-width row
-- per service with the image and copy swapping sides down the page.
--
-- Modelling it as a layout switch rather than a new block type means a site
-- keeps one list of services. Adding a service to the summary adds it to the
-- detail page, and there is no second copy to fall out of step.
--
-- Additive: absent or 'rail' renders exactly as today.

update block_definitions
set
  schema = jsonb_set(
    schema,
    '{properties,layout}',
    '{"type": "string", "enum": ["rail", "detail"]}'::jsonb,
    true
  ),
  -- Appended, because this list doubles as the field display order in the
  -- admin form and the existing entries must keep their positions.
  client_editable_fields = client_editable_fields || array['layout']
where key = 'services_grid'
  and not (schema -> 'properties' ? 'layout');
