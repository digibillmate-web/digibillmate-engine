-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0026: work_process and category_list blocks
--
-- Added while mapping a home-appliance repair site into the engine.
-- Fourteen of its sixteen sections already had a block; these are the
-- two that did not.
--
-- Both are named for what they do rather than for the trade that
-- prompted them, because that is what makes the library compound:
--
--   work_process   every service business explains how it works, and
--                  a numbered sequence is that explanation. A body
--                  shop's "drop off, assess, repair, collect" is the
--                  same block as an appliance repairer's five steps.
--
--   category_list  items grouped under headings. Appliance faults by
--                  machine today; a restaurant menu by course, a
--                  clinic's treatments by department, or an FAQ by
--                  topic tomorrow. Naming it "issues" would have
--                  hidden that from whoever builds the next site.
--
-- Run in the Supabase SQL Editor AFTER 0001-0025.
-- ============================================================

begin;

insert into block_definitions (key, name, description, schema, client_editable_fields) values

('work_process', 'Work Process',
 'Numbered steps explaining how the service works, from first contact to completion.',
 '{
   "type": "object",
   "properties": {
     "title":    { "type": "string" },
     "intro":    { "type": "string" },
     "steps": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "title":       { "type": "string" },
           "description": { "type": "string" },
           "icon":        { "type": "string" }
         }
       }
     }
   }
 }'::jsonb,
 array['title','intro','steps']
),

('category_list', 'Category List',
 'Items grouped under category headings — faults by appliance, dishes by course, services by type.',
 '{
   "type": "object",
   "properties": {
     "title": { "type": "string" },
     "intro": { "type": "string" },
     "categories": {
       "type": "array",
       "items": {
         "type": "object",
         "properties": {
           "title":     { "type": "string" },
           "icon":      { "type": "string" },
           "image_url": { "type": "string" },
           "items": {
             "type": "array",
             "items": {
               "type": "object",
               "properties": {
                 "label": { "type": "string" },
                 "note":  { "type": "string" }
               }
             }
           }
         }
       }
     }
   }
 }'::jsonb,
 array['title','intro','categories']
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
-- select key, name from block_definitions
-- where key in ('work_process', 'category_list');
-- ------------------------------------------------------------
