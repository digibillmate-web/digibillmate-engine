-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0007: per-site Cloudflare deploy hook
--
-- A deploy hook rebuilds one fixed Pages project and cannot be
-- told which site to build, so one hook per site is the only
-- correct arrangement. Holding it on the site row replaces the
-- single CLOUDFLARE_DEPLOY_HOOK_URL env var, which does not scale
-- past the first site.
--
-- Nullable on purpose: a site exists before its Cloudflare project
-- does. A null hook means "not deployable yet", which the publish
-- route should report plainly rather than failing obscurely.
--
-- Run in the Supabase SQL Editor AFTER 0001-0006.
-- ============================================================

begin;

alter table sites
  add column if not exists deploy_hook_url text;

comment on column sites.deploy_hook_url is
  'Cloudflare Pages deploy hook for this site. Secret-ish: anyone holding it can trigger builds. Never expose to a client-role user or to the browser.';

commit;

-- ------------------------------------------------------------
-- Backfill the existing site with the hook currently held in
-- admin-tool/.env.local, so behaviour is unchanged after the
-- publish route switches to reading this column.
--
-- Run this separately, pasting the real hook URL — deliberately
-- not committed to version control:
--
-- update sites
-- set deploy_hook_url = '<paste the dbmcars deploy hook URL>'
-- where subdomain = 'mariacars';
-- ------------------------------------------------------------

-- Verify:
--
-- select subdomain, status,
--        deploy_hook_url is not null as has_hook
-- from sites
-- order by subdomain;
