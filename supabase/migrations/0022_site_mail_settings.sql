-- Per-site mail settings for enquiry notifications.
--
-- The destination was already per site. These add the controls an operator
-- needs around it: whether notifications are on at all, and a ceiling on how
-- many are sent in a month.
--
-- The cap matters because the sending account is shared. Every client site
-- notifies through one Brevo account, so one site with a spam problem or a
-- form loop can burn the plan's allowance and silence every other site. The
-- cap turns that into one noisy site hitting its own limit.
--
-- Additive: null limit means unlimited, notifications default to on, so every
-- existing site behaves exactly as it does today.

alter table sites
  add column if not exists enquiry_notify boolean not null default true,
  add column if not exists enquiry_monthly_limit integer;

alter table sites
  drop constraint if exists sites_enquiry_monthly_limit_check;

alter table sites
  add constraint sites_enquiry_monthly_limit_check
  check (enquiry_monthly_limit is null or enquiry_monthly_limit >= 0);

comment on column sites.enquiry_notify is
  'Send email for new enquiries. False still records them.';

comment on column sites.enquiry_monthly_limit is
  'Max notification emails per calendar month for this site. Null means no limit.';

-- Counting a month of sends per site is the one query the intake path runs on
-- every submission, and the admin repeats it to show usage.
create index if not exists enquiries_site_status_created_idx
  on enquiries (site_id, email_status, created_at desc);
