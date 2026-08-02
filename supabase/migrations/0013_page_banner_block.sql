-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0013: page banner block
--
-- Every inner page on the reference opens with a short banner: a
-- background photo, the page title, and a breadcrumb. Our inner pages
-- drop straight from the header into content, which is the main
-- reason they read as unfinished next to the reference.
--
-- Title is optional on purpose: left blank, the renderer falls back
-- to the page's own title, so adding a banner to a new page needs no
-- retyping and the two cannot drift apart.
--
-- Run in the Supabase SQL Editor AFTER 0001-0012.
-- ============================================================

begin;

insert into block_definitions (key, name, description, schema, client_editable_fields) values

('page_banner', 'Page Banner',
 'Short banner opening an inner page: background image, title and breadcrumb.',
 '{
   "type": "object",
   "properties": {
     "title":            { "type": "string" },
     "subtitle":         { "type": "string" },
     "background_image": { "type": "string" },
     "show_breadcrumb":  { "type": "boolean" }
   }
 }'::jsonb,
 array['title','subtitle','background_image']
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
-- select key, name from block_definitions where key = 'page_banner';
-- ------------------------------------------------------------
