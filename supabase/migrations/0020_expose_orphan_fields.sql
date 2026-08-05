-- Make every schema field reachable from the admin.
--
-- client_editable_fields is what the admin form renders from, and it had
-- drifted behind the schemas. Thirteen fields existed in a block's schema and
-- were read by the export pipeline, but had no control anywhere — including
-- the header logo, the footer business name, the hero background and the
-- about section's image.
--
-- That is the worst kind of gap: the field works, the value renders, and the
-- only thing missing is any way for an operator to set it. It is why the site
-- logo could not be changed from the portal.
--
-- The list doubles as the form's display order, so missing fields are
-- appended rather than the list rebuilt — existing fields keep their places.

with orphans as (
  select
    d.id,
    array_agg(k.key order by k.ord) as missing
  from block_definitions d
  cross join lateral (
    select key, ordinality as ord
    from jsonb_object_keys(d.schema -> 'properties') with ordinality as t(key, ordinality)
  ) k
  where not (d.client_editable_fields @> array[k.key])
  group by d.id
)
update block_definitions d
set client_editable_fields = d.client_editable_fields || o.missing
from orphans o
where d.id = o.id;
