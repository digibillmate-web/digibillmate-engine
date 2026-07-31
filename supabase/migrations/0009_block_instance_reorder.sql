-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0009: hideable blocks, and reorderable positions
--
-- Two problems, both structural:
--
-- 1. Removing a block from a site should not destroy its content.
--    An operator who hides a testimonials block and changes their
--    mind a week later should get their reviews back, not retype
--    them. is_hidden sets a block aside while keeping the row.
--
-- 2. unique (site_id, position) is NOT DEFERRABLE, so swapping two
--    blocks' positions trips the constraint mid-statement even
--    though the final state is valid. Making it deferrable lets a
--    whole reorder land as one statement, which is the difference
--    between an atomic reorder and a half-applied one.
--
-- Run in the Supabase SQL Editor AFTER 0001-0008.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. HIDEABLE BLOCKS
--
-- Hidden blocks keep their row, their content and their position.
-- The export pipeline skips them, so they vanish from the built
-- site without vanishing from the database.
-- ------------------------------------------------------------
alter table block_instances
  add column if not exists is_hidden boolean not null default false;

comment on column block_instances.is_hidden is
  'Block is set aside: keeps its content and position but is skipped by the export pipeline.';

create index if not exists idx_block_instances_site_visible
  on block_instances (site_id, position)
  where not is_hidden;

-- ------------------------------------------------------------
-- 2. DEFERRABLE POSITION UNIQUENESS
--
-- The constraint name is the Postgres default from 0001. Guarded so
-- the migration is safe to re-run and safe if it was ever renamed.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'block_instances_site_id_position_key'
      and conrelid = 'block_instances'::regclass
  ) then
    alter table block_instances
      drop constraint block_instances_site_id_position_key;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'block_instances_site_position_unique'
      and conrelid = 'block_instances'::regclass
  ) then
    alter table block_instances
      add constraint block_instances_site_position_unique
      unique (site_id, position) deferrable initially deferred;
  end if;
end $$;

commit;

-- ------------------------------------------------------------
-- Verify:
--
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_name = 'block_instances' and column_name = 'is_hidden';
--
-- Expect condeferrable = true:
--
-- select conname, condeferrable, condeferred
-- from pg_constraint
-- where conrelid = 'block_instances'::regclass and contype = 'u';
--
-- A swap should now succeed in one statement:
--
-- begin;
--   update block_instances set position = 999 where id = '<a>';
--   -- ... (the app does this as a single upsert instead)
-- rollback;
-- ------------------------------------------------------------
