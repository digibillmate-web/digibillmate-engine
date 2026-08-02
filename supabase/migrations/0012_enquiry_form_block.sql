-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0012: enquiry form block
--
-- The reference site posts its enquiry form to email.php. Our output
-- is a static artifact on Cloudflare, so there is no server to post
-- to, and adding one would mean a backend, spam handling and a
-- deliverability story for what is currently a pure static build.
--
-- Instead the form composes the enquiry into a WhatsApp message (or
-- an email, when no WhatsApp number is set) and hands it to the
-- visitor's own client. That is how this category of business
-- actually receives enquiries, it needs no backend, and it cannot be
-- abused as an open relay because nothing is sent server-side.
--
-- Run in the Supabase SQL Editor AFTER 0001-0011.
-- ============================================================

begin;

insert into block_definitions (key, name, description, schema, client_editable_fields) values

('enquiry_form', 'Enquiry Form',
 'Contact form that opens a prefilled WhatsApp message, or an email when no WhatsApp number is set.',
 '{
   "type": "object",
   "properties": {
     "title":            { "type": "string" },
     "intro":            { "type": "string" },
     "whatsapp_number":  { "type": "string" },
     "email":            { "type": "string" },
     "submit_label":     { "type": "string" },
     "show_service_field": { "type": "boolean" },
     "service_options": {
       "type": "array",
       "items": { "type": "string" }
     },
     "footnote":         { "type": "string" }
   },
   "required": ["title"]
 }'::jsonb,
 array['title','intro','whatsapp_number','email','submit_label','service_options','footnote']
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
-- select key, name from block_definitions where key = 'enquiry_form';
--
-- The block is now in the catalog, so it can be added to any page
-- from the admin portal's Content tab.
-- ------------------------------------------------------------
