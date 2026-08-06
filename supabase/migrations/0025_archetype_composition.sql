-- Templates that carry their page structure.
--
-- archetype_blocks is a flat, ordered list of blocks: it was designed before
-- migration 0011 introduced site_pages, when a site was one page. Promoting
-- today's six-page site through it would quietly flatten it to one, and the
-- loss would only surface when someone built from the template and found the
-- inner pages missing.
--
-- A snapshot rather than a second set of tables. A template is a picture of a
-- site at a moment, not a living structure to be edited in place: nothing
-- reorders an archetype's pages, and giving them their own tables would mean
-- maintaining page CRUD twice for no gain.
--
-- Nullable, and archetype_blocks is left untouched: the existing archetype
-- keeps working through the old path, and only templates saved from a site
-- carry a composition.

alter table archetypes
  add column if not exists composition jsonb;

comment on column archetypes.composition is
  'Snapshot of pages and their blocks, saved from a site. Null falls back to archetype_blocks.';

-- Where a template came from, for the operator who later asks "which site is
-- this a copy of?". Not a foreign key: the source site may be deleted long
-- before the template is retired, and that must not cascade.
alter table archetypes
  add column if not exists source_site_name text,
  add column if not exists updated_from_site_at timestamptz;

comment on column archetypes.source_site_name is
  'Name of the site this template was saved from, at the time it was saved.';
