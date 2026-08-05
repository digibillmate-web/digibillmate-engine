-- Per-page accent colours and reveal animation.
--
-- The site theme stays the master: a page overrides a small, named set of
-- accent colours rather than the whole palette. Letting a page override every
-- token would make the Theme tab meaningless, because six pages could drift
-- into six unrelated designs and nothing would tie them together.
--
-- Both columns are additive and default to "follow the site", so every
-- existing page renders exactly as it does today.

alter table site_pages
  -- Bare token keys ("color-primary"), the same shape as sites.theme, so the
  -- export pipeline can merge them without knowing page-specific rules.
  add column if not exists theme_overrides jsonb not null default '{}'::jsonb,
  add column if not exists reveal_animation text;

-- A fixed menu rather than free text: each value has a matching CSS rule in
-- the site builder, so an unknown value would silently render no animation.
alter table site_pages
  drop constraint if exists site_pages_reveal_animation_check;

alter table site_pages
  add constraint site_pages_reveal_animation_check
  check (
    reveal_animation is null
    or reveal_animation in ('fade-up', 'fade', 'slide-left', 'slide-right', 'zoom', 'none')
  );

comment on column site_pages.theme_overrides is
  'Per-page accent overrides, merged over the site theme at export. Empty means follow the site.';

comment on column site_pages.reveal_animation is
  'Scroll-reveal style for this page. Null means follow the site default (fade-up).';
