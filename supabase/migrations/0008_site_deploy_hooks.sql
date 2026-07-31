-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0008: move deploy hooks out of the sites row
--
-- A deploy hook is a capability: anyone holding the URL can trigger
-- unlimited builds of that site. Postgres RLS is row-level, not
-- column-level, so while the hook lived on sites the policy
-- "clients can view their own sites" (0002) handed it to every
-- client-role user along with the rest of the row.
--
-- Moving it to its own admin-only table makes RLS do the work: a
-- client-role user has no policy on this table at all, so they
-- cannot read a hook even for a site they own.
--
-- Run in the Supabase SQL Editor AFTER 0001-0007.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. TABLE
--
-- site_id is the primary key: one hook per site, and the row dies
-- with the site.
-- ------------------------------------------------------------
create table if not exists site_deploy_hooks (
  site_id    uuid primary key references sites(id) on delete cascade,
  url        text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table site_deploy_hooks is
  'Cloudflare deploy hook per site. Admin-only: the URL is a capability, so it is deliberately not readable by client-role users.';

drop trigger if exists trg_site_deploy_hooks_updated_at on site_deploy_hooks;
create trigger trg_site_deploy_hooks_updated_at before update on site_deploy_hooks
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 2. RLS — admin only, no client-role policy whatsoever
--
-- With RLS enabled and no policy granting them access, client-role
-- users get zero rows rather than an error. service_role still
-- bypasses everything, which is how any server-side pipeline reads.
-- ------------------------------------------------------------
alter table site_deploy_hooks enable row level security;

drop policy if exists "admins manage site_deploy_hooks" on site_deploy_hooks;

create policy "admins manage site_deploy_hooks"
  on site_deploy_hooks for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- 3. MIGRATE any existing value
--
-- No-op when nothing was set yet. Safe to re-run: an existing row
-- for the same site is left alone rather than overwritten, so this
-- cannot clobber a hook saved through the admin portal.
-- ------------------------------------------------------------
insert into site_deploy_hooks (site_id, url)
select s.id, s.deploy_hook_url
from sites s
where s.deploy_hook_url is not null
on conflict (site_id) do nothing;

-- ------------------------------------------------------------
-- 4. DROP the old column
--
-- Do this last so the copy above still has something to read.
-- ------------------------------------------------------------
alter table sites
  drop column if exists deploy_hook_url;

commit;

-- ------------------------------------------------------------
-- Verify:
--
-- select s.subdomain,
--        h.url is not null as has_hook,
--        h.updated_at
-- from sites s
-- left join site_deploy_hooks h on h.site_id = s.id
-- order by s.subdomain;
--
-- Column is gone (expect 0 rows):
--
-- select column_name
-- from information_schema.columns
-- where table_name = 'sites' and column_name = 'deploy_hook_url';
--
-- Policies on the new table (expect exactly 1, cmd = ALL):
--
-- select policyname, cmd, roles
-- from pg_policies
-- where tablename = 'site_deploy_hooks';
-- ------------------------------------------------------------
