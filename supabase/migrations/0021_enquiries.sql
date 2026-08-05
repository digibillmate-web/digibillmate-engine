-- Enquiries submitted through a built site's form.
--
-- Until now an enquiry existed only as a WhatsApp or mailto link handed to
-- the visitor's own app. If they did not press send, it never happened, and
-- nobody could tell the difference between a quiet week and a broken form.
--
-- This table is the record. Email is a notification layered on top: it can
-- bounce, land in spam, or be deleted, and the row survives all three.

-- Where this site's enquiries are sent. Per site, not global: one portal runs
-- many clients' sites, and they do not share an inbox.
alter table sites
  add column if not exists enquiry_email text;

comment on column sites.enquiry_email is
  'Destination for enquiry notifications. Null means store only, no email.';

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,

  name text not null,
  mobile text not null,
  email text,
  service text,
  message text,

  -- Delivery is tracked separately from the enquiry itself. A send that fails
  -- must not lose the enquiry, and 'pending' is what lets a retry find it.
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  email_error text,

  -- Kept for abuse triage: a burst from one address is the signal that the
  -- honeypot and rate limit need attention.
  source_ip text,
  user_agent text,

  created_at timestamptz not null default now()
);

create index if not exists enquiries_site_created_idx
  on enquiries (site_id, created_at desc);

create index if not exists enquiries_pending_idx
  on enquiries (email_status)
  where email_status = 'pending';

alter table enquiries enable row level security;

/*
 * No insert policy, deliberately.
 *
 * Submissions arrive from a static site with no session, so they are written
 * by the API route using the service role, which bypasses RLS. Adding an
 * anon insert policy would let anyone POST straight to PostgREST and skip the
 * honeypot, the rate limit and the site check entirely.
 */
drop policy if exists "admins read enquiries" on enquiries;
create policy "admins read enquiries" on enquiries
  for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists "admins update enquiries" on enquiries;
create policy "admins update enquiries" on enquiries
  for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

comment on table enquiries is
  'Form submissions from built sites. Written by the /api/enquiry route under the service role; read by admins.';
