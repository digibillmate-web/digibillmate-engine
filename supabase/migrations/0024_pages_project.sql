-- Which Cloudflare Pages project builds this site.
--
-- Not derivable from the subdomain: the live site's subdomain is
-- "digibillmate" while its Pages project is "dbmcars". Guessing one from the
-- other would send a build to the wrong project, or report success for a
-- project that does not exist.
--
-- Nullable because a site can exist before it is provisioned — that is the
-- normal state between creating a site and pushing it live.

alter table sites
  add column if not exists pages_project text;

comment on column sites.pages_project is
  'Cloudflare Pages project name. Null means the site has not been provisioned yet.';

-- One project builds one site; two sites pointing at the same project would
-- overwrite each other on every deploy.
create unique index if not exists sites_pages_project_key
  on sites (pages_project)
  where pages_project is not null;
