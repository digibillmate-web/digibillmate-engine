-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0002: Row Level Security
--
-- Model:
--  - 'admin' role (you two): full access to everything.
--  - 'client' role (future): can only SEE their own client's
--    sites/block_instances, and can only WRITE to
--    block_instances.content_draft (never content directly,
--    never composition, never theme, never other tables).
--  - service_role key (used by server-side scripts, e.g. export
--    pipeline) bypasses RLS entirely by design - never expose
--    this key to any frontend.
-- ============================================================

-- Enable RLS on every table that holds business data
alter table profiles enable row level security;
alter table clients enable row level security;
alter table block_definitions enable row level security;
alter table archetypes enable row level security;
alter table archetype_blocks enable row level security;
alter table sites enable row level security;
alter table block_instances enable row level security;

-- ------------------------------------------------------------
-- Helper: is the current user an admin?
-- ------------------------------------------------------------
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- Helper: which client_id does the current user (if role='client') belong to?
create or replace function current_client_id()
returns uuid as $$
  select client_id from profiles where id = auth.uid();
$$ language sql stable security definer;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
create policy "admins manage all profiles"
  on profiles for all
  using (is_admin())
  with check (is_admin());

create policy "users can read their own profile"
  on profiles for select
  using (id = auth.uid());

-- ------------------------------------------------------------
-- CLIENTS  (admin only for now - clients don't manage their own record yet)
-- ------------------------------------------------------------
create policy "admins manage clients"
  on clients for all
  using (is_admin())
  with check (is_admin());

-- ------------------------------------------------------------
-- BLOCK DEFINITIONS  (admin only - this is the code-backed catalog)
-- ------------------------------------------------------------
create policy "admins manage block_definitions"
  on block_definitions for all
  using (is_admin())
  with check (is_admin());

-- Everyone authenticated can read block_definitions (needed to render forms)
create policy "authenticated users can read block_definitions"
  on block_definitions for select
  using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- ARCHETYPES / ARCHETYPE_BLOCKS  (admin only)
-- ------------------------------------------------------------
create policy "admins manage archetypes"
  on archetypes for all
  using (is_admin())
  with check (is_admin());

create policy "authenticated users can read archetypes"
  on archetypes for select
  using (auth.role() = 'authenticated');

create policy "admins manage archetype_blocks"
  on archetype_blocks for all
  using (is_admin())
  with check (is_admin());

create policy "authenticated users can read archetype_blocks"
  on archetype_blocks for select
  using (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- SITES
-- Admin: full access.
-- Client: can only SELECT their own client's sites. No writes -
-- site-level settings (domain, theme, composition) stay dev-only.
-- ------------------------------------------------------------
create policy "admins manage sites"
  on sites for all
  using (is_admin())
  with check (is_admin());

create policy "clients can view their own sites"
  on sites for select
  using (client_id = current_client_id());

-- ------------------------------------------------------------
-- BLOCK INSTANCES
-- Admin: full access.
-- Client: can view instances belonging to their own site, and
-- can update ONLY the content_draft field (enforced by only
-- allowing update, application layer restricts which fields are
-- sent - see note below on defense in depth).
-- ------------------------------------------------------------
create policy "admins manage block_instances"
  on block_instances for all
  using (is_admin())
  with check (is_admin());

create policy "clients can view their own block_instances"
  on block_instances for select
  using (
    site_id in (
      select id from sites where client_id = current_client_id()
    )
  );

create policy "clients can draft-edit their own block_instances"
  on block_instances for update
  using (
    site_id in (
      select id from sites where client_id = current_client_id()
    )
  )
  with check (
    site_id in (
      select id from sites where client_id = current_client_id()
    )
  );

-- NOTE: Postgres RLS policies control row access, not individual
-- column writes. To stop a 'client' user from overwriting `content`
-- (published) directly instead of `content_draft`, the thin API
-- layer (never the client hitting Supabase directly) must be the
-- only path client edits take. This is why the architecture calls
-- for a server-side function / API layer in front of Supabase for
-- all client-role writes, rather than direct table access from
-- the admin-tool frontend for that role.
