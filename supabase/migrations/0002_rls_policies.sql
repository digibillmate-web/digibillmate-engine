-- 0002_rls_policies.sql
-- Row Level Security. Tenancy flows from clients.owner_id:
--   clients -> sites -> blocks
-- The service_role key bypasses RLS entirely and is unaffected by this file.

alter table public.clients    enable row level security;
alter table public.sites      enable row level security;
alter table public.blocks     enable row level security;
alter table public.archetypes enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: does the current user own this client?
-- ---------------------------------------------------------------------------

create or replace function public.owns_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clients c
    where c.id = target_client_id
      and c.owner_id = auth.uid()
  );
$$;

create or replace function public.owns_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sites s
    join public.clients c on c.id = s.client_id
    where s.id = target_site_id
      and c.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create policy "clients_select_own"
  on public.clients for select
  to authenticated
  using (owner_id = auth.uid());

create policy "clients_insert_own"
  on public.clients for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "clients_update_own"
  on public.clients for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "clients_delete_own"
  on public.clients for delete
  to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- sites
-- ---------------------------------------------------------------------------

create policy "sites_select_own"
  on public.sites for select
  to authenticated
  using (public.owns_client(client_id));

create policy "sites_insert_own"
  on public.sites for insert
  to authenticated
  with check (public.owns_client(client_id));

create policy "sites_update_own"
  on public.sites for update
  to authenticated
  using (public.owns_client(client_id))
  with check (public.owns_client(client_id));

create policy "sites_delete_own"
  on public.sites for delete
  to authenticated
  using (public.owns_client(client_id));

-- Published sites are readable by anyone (public site rendering).
create policy "sites_select_published_public"
  on public.sites for select
  to anon
  using (status = 'published');

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------

create policy "blocks_select_own"
  on public.blocks for select
  to authenticated
  using (public.owns_site(site_id));

create policy "blocks_insert_own"
  on public.blocks for insert
  to authenticated
  with check (public.owns_site(site_id));

create policy "blocks_update_own"
  on public.blocks for update
  to authenticated
  using (public.owns_site(site_id))
  with check (public.owns_site(site_id));

create policy "blocks_delete_own"
  on public.blocks for delete
  to authenticated
  using (public.owns_site(site_id));

-- Blocks of published sites are publicly readable.
create policy "blocks_select_published_public"
  on public.blocks for select
  to anon
  using (
    is_visible
    and exists (
      select 1 from public.sites s
      where s.id = blocks.site_id
        and s.status = 'published'
    )
  );

-- ---------------------------------------------------------------------------
-- archetypes
-- Read-only library for clients; writes are service_role only (no policy).
-- ---------------------------------------------------------------------------

create policy "archetypes_select_published"
  on public.archetypes for select
  to authenticated, anon
  using (is_published);
