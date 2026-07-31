-- 0001_init_schema.sql
-- Core DigiBillMate engine schema: clients, sites, blocks, archetypes.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- archetypes
-- Reusable site templates. Global library, not owned by any client.
-- ---------------------------------------------------------------------------

create table public.archetypes (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text,
  -- Default block layout applied when a site is created from this archetype.
  template     jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index archetypes_published_idx on public.archetypes (is_published);

create trigger archetypes_set_updated_at
  before update on public.archetypes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- clients
-- A client is the tenant boundary. owner_id maps to the Supabase auth user.
-- ---------------------------------------------------------------------------

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  email       text,
  phone       text,
  status      text not null default 'active'
                check (status in ('active', 'suspended', 'archived')),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index clients_owner_id_idx on public.clients (owner_id);
create index clients_status_idx on public.clients (status);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sites
-- ---------------------------------------------------------------------------

create table public.sites (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  archetype_id  uuid references public.archetypes (id) on delete set null,
  name          text not null,
  slug          text not null,
  domain        text unique,
  status        text not null default 'draft'
                  check (status in ('draft', 'published', 'archived')),
  settings      jsonb not null default '{}'::jsonb,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, slug)
);

create index sites_client_id_idx on public.sites (client_id);
create index sites_archetype_id_idx on public.sites (archetype_id);
create index sites_status_idx on public.sites (status);

create trigger sites_set_updated_at
  before update on public.sites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- blocks
-- Ordered, optionally nested content units belonging to a site.
-- ---------------------------------------------------------------------------

create table public.blocks (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references public.sites (id) on delete cascade,
  parent_id   uuid references public.blocks (id) on delete cascade,
  type        text not null,
  position    integer not null default 0,
  content     jsonb not null default '{}'::jsonb,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index blocks_site_id_idx on public.blocks (site_id);
create index blocks_parent_id_idx on public.blocks (parent_id);
create index blocks_site_position_idx on public.blocks (site_id, position);

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();
