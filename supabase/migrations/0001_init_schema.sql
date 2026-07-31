-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0001: Core schema
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- Links a Supabase Auth user to a role in our system.
-- 'admin'  = internal team (you two), full access.
-- 'client' = a business owner, scoped to one Site (future use).
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'client')),
  full_name text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- CLIENTS
-- The business entity. Owns one or more Sites.
-- ------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,          -- e.g. 'auto_service', 'saas' - informal tag, not a hard constraint
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Links a client-role user to the client they're allowed to manage.
-- A client user can belong to exactly one client business.
alter table profiles add column client_id uuid references clients(id) on delete set null;

-- ------------------------------------------------------------
-- BLOCK DEFINITIONS
-- The shared, code-backed catalog. One row = one component
-- that exists in the Astro site-builder (e.g. "hero", "services_grid").
-- The `schema` field describes what data the block needs.
-- ------------------------------------------------------------
create table block_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,           -- e.g. 'hero', 'services_grid' - must match the Astro component name
  name text not null,                 -- human-readable, e.g. "Hero Banner"
  description text,
  schema jsonb not null,              -- JSON Schema-like description of the block's content shape
  client_editable_fields text[] not null default '{}', -- which top-level field keys a 'client' role may edit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ARCHETYPES
-- Industry-level presets. Pure data: an ordered list of blocks
-- (via archetype_blocks) + a default theme.
-- ------------------------------------------------------------
create table archetypes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,          -- e.g. 'auto_service_repair'
  name text not null,                -- e.g. "Auto Service & Repair"
  description text,
  default_theme jsonb not null default '{}', -- design tokens: colors, fonts, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The default composition of an archetype: which blocks, in what order,
-- with what starter content.
create table archetype_blocks (
  id uuid primary key default gen_random_uuid(),
  archetype_id uuid not null references archetypes(id) on delete cascade,
  block_definition_id uuid not null references block_definitions(id) on delete restrict,
  position int not null,
  default_content jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (archetype_id, position)
);

-- ------------------------------------------------------------
-- SITES
-- One deployable client website.
-- ------------------------------------------------------------
create table sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  archetype_id uuid not null references archetypes(id) on delete restrict,

  name text not null,                       -- internal label, e.g. "Maria Cars - Guindy"
  subdomain text unique,                    -- e.g. 'mariacars' -> mariacars.digibillmate.com
  custom_domain text unique,                -- e.g. 'mariacars.co.in', nullable until client points it

  theme jsonb not null default '{}',        -- this site's theme (starts as copy of archetype default_theme)

  -- Fork tracking: does this site still track its archetype, or has it diverged?
  composition_linked boolean not null default true,
  theme_linked boolean not null default true,

  -- Client self-edit controls (future use)
  require_approval boolean not null default true,

  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  last_published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- BLOCK INSTANCES
-- One block, on one site, with real content.
-- This is what actually renders.
-- ------------------------------------------------------------
create table block_instances (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  block_definition_id uuid not null references block_definitions(id) on delete restrict,

  position int not null,

  content jsonb not null default '{}',         -- live, published content
  content_draft jsonb,                          -- pending client edit awaiting approval (null = no pending draft)

  settings jsonb not null default '{}',         -- instance-level display settings (e.g. "columns: 3")

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (site_id, position)
);

-- ------------------------------------------------------------
-- Helpful indexes
-- ------------------------------------------------------------
create index idx_sites_client_id on sites(client_id);
create index idx_sites_archetype_id on sites(archetype_id);
create index idx_block_instances_site_id on block_instances(site_id);
create index idx_archetype_blocks_archetype_id on archetype_blocks(archetype_id);

-- ------------------------------------------------------------
-- updated_at auto-touch trigger (applied to tables that need it)
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_clients_updated_at before update on clients
  for each row execute function set_updated_at();
create trigger trg_block_definitions_updated_at before update on block_definitions
  for each row execute function set_updated_at();
create trigger trg_archetypes_updated_at before update on archetypes
  for each row execute function set_updated_at();
create trigger trg_sites_updated_at before update on sites
  for each row execute function set_updated_at();
create trigger trg_block_instances_updated_at before update on block_instances
  for each row execute function set_updated_at();
