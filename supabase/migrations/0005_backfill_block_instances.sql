-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0005: Backfill block_instances for Maria Cars
--
-- Until now this site rendered straight from archetype_blocks
-- (composition_linked = true), so it had no rows of its own. The
-- admin portal edits block_instances, and the export pipeline is
-- changing to always read from block_instances, so the site needs
-- a real per-site copy of its composition.
--
-- Content is copied verbatim from archetype_blocks.default_content.
-- No content values are edited here — the "Maria Cars" -> new-name
-- rename happens later, through the admin portal.
--
-- Run in the Supabase SQL Editor AFTER 0001-0004.
-- Expected result: 11 rows inserted (0 on any re-run).
-- ============================================================

begin;

insert into block_instances (site_id, block_definition_id, position, content)
select
  s.id,
  ab.block_definition_id,
  ab.position,
  ab.default_content
from sites s
join archetype_blocks ab
  on ab.archetype_id = s.archetype_id
where s.id = '70f131fe-8b09-42f9-8682-8d8dfcebafe1'
  -- Idempotent: skip any position this site already has an instance for.
  -- Matches the table's own unique (site_id, position) constraint, so a
  -- re-run inserts nothing rather than erroring.
  and not exists (
    select 1
    from block_instances bi
    where bi.site_id = s.id
      and bi.position = ab.position
  );

commit;

-- ------------------------------------------------------------
-- Verify — expect 11 rows, positions 1-11, keys in this order:
--   1 floating_contact_bar   7 why_choose_us
--   2 header_nav             8 gallery
--   3 hero                   9 testimonials
--   4 about_section         10 contact
--   5 services_grid         11 footer
--   6 brand_logos
--
-- select bi.position, bd.key, jsonb_pretty(bi.content) as content
-- from block_instances bi
-- join block_definitions bd on bd.id = bi.block_definition_id
-- where bi.site_id = '70f131fe-8b09-42f9-8682-8d8dfcebafe1'
-- order by bi.position;
--
-- Confirm the copy is exact (expect 0 rows):
--
-- select ab.position, bd.key
-- from archetype_blocks ab
-- join sites s on s.archetype_id = ab.archetype_id
-- join block_definitions bd on bd.id = ab.block_definition_id
-- left join block_instances bi
--   on bi.site_id = s.id and bi.position = ab.position
-- where s.id = '70f131fe-8b09-42f9-8682-8d8dfcebafe1'
--   and (bi.id is null or bi.content is distinct from ab.default_content);
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- NOTE on composition_linked
--
-- This site still has composition_linked = true, which now means
-- only "the composition was inherited from the archetype", not
-- "read content from the archetype at build time". Once the admin
-- portal edits these rows the site has genuinely diverged, and you
-- may want to set it false:
--
-- update sites set composition_linked = false
-- where id = '70f131fe-8b09-42f9-8682-8d8dfcebafe1';
--
-- Deliberately NOT done here — it is a semantic decision, and the
-- export pipeline no longer branches on this flag either way.
-- ------------------------------------------------------------
