-- ============================================================
-- DigiBillMate Website Builder Engine
-- Migration 0006: site-media storage bucket
--
-- Holds images uploaded through the admin portal (block photos,
-- logos, avatars, QR codes). Public read so built sites can hotlink
-- the URLs without signing; writes restricted to admin-role users
-- via the is_admin() helper from 0002.
--
-- Run in the Supabase SQL Editor AFTER 0001-0005.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. BUCKET
--
-- public = true makes objects readable at
--   <SUPABASE_URL>/storage/v1/object/public/site-media/<path>
-- which is what gets written into block_instances.content.
--
-- Idempotent: re-running updates the limits rather than failing.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 2. POLICIES on storage.objects
--
-- RLS is already enabled on storage.objects by Supabase; these add
-- bucket-scoped rules. Dropped first so the migration is re-runnable
-- (CREATE POLICY has no IF NOT EXISTS).
--
-- The service_role key bypasses all of this, which is how the
-- publish/export pipeline reads regardless.
-- ------------------------------------------------------------

drop policy if exists "site-media public read"   on storage.objects;
drop policy if exists "site-media admin insert"  on storage.objects;
drop policy if exists "site-media admin update"  on storage.objects;
drop policy if exists "site-media admin delete"  on storage.objects;

-- Anyone, signed in or not, may read. Published sites are public.
create policy "site-media public read"
  on storage.objects for select
  using (bucket_id = 'site-media');

-- Only admin-role profiles may write. Uses the same helper as every
-- other table's admin policy, so there is one definition of "admin".
create policy "site-media admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-media' and is_admin());

create policy "site-media admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-media' and is_admin())
  with check (bucket_id = 'site-media' and is_admin());

create policy "site-media admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-media' and is_admin());

commit;

-- ------------------------------------------------------------
-- Verify:
--
-- select id, public, file_size_limit from storage.buckets
-- where id = 'site-media';
--
-- select policyname, cmd from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
--   and policyname like 'site-media%'
-- order by policyname;
--
-- Expect 1 bucket row and 4 policy rows (select/insert/update/delete).
-- ------------------------------------------------------------
