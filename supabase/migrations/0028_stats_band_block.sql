-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0028: stats_band block
--
-- The last section of the appliance reference with no home in the
-- engine: a row of large figures with a label under each —
-- 5000+ happy customers, 12+ years, 24/7 support, 100% satisfaction.
--
-- Named for the shape, not the trade. Every business has numbers it
-- wants believed: jobs completed, years trading, warranty length,
-- response time. A car shop's "2,000 cars repaired · 15 years ·
-- 5 year warranty" is the same block.
--
-- Run in the Supabase SQL Editor AFTER 0001-0027.
-- ============================================================

begin;

insert into block_definitions (key, name, description, schema, client_editable_fields) values

('stats_band', 'Stats Band',
 'A row of headline figures with a label under each — customers served, years trading, warranty length.',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string" },
     "intro": { "type": "string" },
     "stats": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "value": { "type": "string" },
           "label": { "type": "string" },
           "note":  { "type": "string" }
         }
       }
     }
   }
 }'::jsonb,
 array['title','intro','stats']
)

on conflict (key) do update set
  name                   = excluded.name,
  description            = excluded.description,
  schema                 = excluded.schema,
  client_editable_fields = excluded.client_editable_fields;

commit;

-- ------------------------------------------------------------
-- Verify:
--
-- select key, name from block_definitions where key = 'stats_band';
-- ------------------------------------------------------------
