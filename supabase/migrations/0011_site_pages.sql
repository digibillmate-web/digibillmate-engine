-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0011: multiple pages per site
--
-- Until now a site was one page: every block_instance rendered into
-- a single index.html. Real sites in this category are multi-page
-- (home / about / services / gallery / contact), so a block now
-- belongs to a page, and a page belongs to a site.
--
-- Safe on live data: every existing site gets a Home page and all of
-- its current blocks are attached to it, so nothing changes visually
-- until pages are actually added through the portal.
--
-- Run in the Supabase SQL Editor AFTER 0001-0010.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. PAGES
--
-- slug '' is the home page: it builds to /index.html, everything
-- else builds to /<slug>/index.html. Storing it as empty rather
-- than 'home' keeps the slug column and the built URL the same
-- thing, with no special case at render time.
-- ------------------------------------------------------------
create table if not exists site_pages (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,

  slug       text not null,                       -- '' = home, else 'about', 'gallery'
  title      text not null,                       -- browser tab + default nav label
  nav_label  text,                                -- overrides title in navigation
  position   int  not null,                       -- nav order
  show_in_nav boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (site_id, slug)
);

comment on table site_pages is
  'One page of a site. slug is empty for the home page, which builds to /index.html.';

create index if not exists idx_site_pages_site on site_pages (site_id, position);

drop trigger if exists trg_site_pages_updated_at on site_pages;
create trigger trg_site_pages_updated_at before update on site_pages
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 2. RLS — same shape as sites: admins manage, clients read
--    their own.
-- ------------------------------------------------------------
alter table site_pages enable row level security;

drop policy if exists "admins manage site_pages" on site_pages;
drop policy if exists "clients can view their own site_pages" on site_pages;

create policy "admins manage site_pages"
  on site_pages for all
  using (is_admin())
  with check (is_admin());

create policy "clients can view their own site_pages"
  on site_pages for select
  using (
    site_id in (select id from sites where client_id = current_client_id())
  );

-- ------------------------------------------------------------
-- 3. BLOCKS BELONG TO A PAGE
--
-- Nullable for now so the backfill below has something to fill.
-- ------------------------------------------------------------
alter table block_instances
  add column if not exists page_id uuid references site_pages(id) on delete cascade;

-- ------------------------------------------------------------
-- 4. BACKFILL
--
-- Give every existing site a Home page, then attach all of that
-- site's blocks to it. Idempotent: a site that already has a home
-- page is skipped, and blocks that already have a page keep it.
-- ------------------------------------------------------------
insert into site_pages (site_id, slug, title, position)
select s.id, '', 'Home', 1
from sites s
where not exists (
  select 1 from site_pages p where p.site_id = s.id and p.slug = ''
);

update block_instances bi
set page_id = p.id
from site_pages p
where p.site_id = bi.site_id
  and p.slug = ''
  and bi.page_id is null;

-- Every block now has a page, so the column can be required.
alter table block_instances
  alter column page_id set not null;

-- ------------------------------------------------------------
-- 5. POSITION IS NOW PER PAGE, NOT PER SITE
--
-- Two pages both having a block at position 1 is normal. The old
-- (site_id, position) constraint would reject that.
--
-- Deferrable for the same reason as 0009: a whole reorder has to be
-- able to land as one statement.
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'block_instances_site_position_unique'
      and conrelid = 'block_instances'::regclass
  ) then
    alter table block_instances
      drop constraint block_instances_site_position_unique;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'block_instances_page_position_unique'
      and conrelid = 'block_instances'::regclass
  ) then
    alter table block_instances
      add constraint block_instances_page_position_unique
      unique (page_id, position) deferrable initially deferred;
  end if;
end $$;

create index if not exists idx_block_instances_page
  on block_instances (page_id, position);

commit;

-- ------------------------------------------------------------
-- Verify — every site should have exactly one Home page, and every
-- block should be attached to it:
--
-- select s.subdomain, p.slug, p.title, count(bi.id) as blocks
-- from sites s
-- join site_pages p on p.site_id = s.id
-- left join block_instances bi on bi.page_id = p.id
-- group by s.subdomain, p.slug, p.title, p.position
-- order by s.subdomain, p.position;
--
-- Expect 0 rows (no orphans):
--
-- select count(*) from block_instances where page_id is null;
--
-- Expect condeferrable = true on the page/position constraint:
--
-- select conname, condeferrable from pg_constraint
-- where conrelid = 'block_instances'::regclass and contype = 'u';
-- ------------------------------------------------------------
