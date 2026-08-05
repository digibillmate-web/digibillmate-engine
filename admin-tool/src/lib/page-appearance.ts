/**
 * What a page is allowed to change about itself.
 *
 * Deliberately a short list. The site theme is the master: a page overrides a
 * few accents so it reads as its own section of the site, not so it can become
 * a different site. If a page could override every token, the Theme tab would
 * stop describing anything and six pages could drift into six designs with
 * nothing tying them together.
 *
 * Text and border colours are absent on purpose — those carry the site's
 * legibility, and a page-level override is how a footer ends up unreadable.
 */
export interface PageTokenSpec {
  key: string;
  label: string;
  hint: string;
}

export const PAGE_OVERRIDE_TOKENS: PageTokenSpec[] = [
  {
    key: 'color-primary',
    label: 'Primary',
    hint: 'Buttons, prices, icons and accents on this page',
  },
  {
    key: 'color-primary-contrast',
    label: 'Text on primary',
    hint: 'Keep it readable against this page’s primary',
  },
  {
    key: 'color-secondary',
    label: 'Secondary',
    hint: 'Dark bands and the page banner',
  },
  {
    key: 'color-surface',
    label: 'Surface',
    hint: 'Tinted section bands on this page',
  },
];

/**
 * Reveal styles the site builder has CSS for.
 *
 * Must stay in step with the CSS in site-builder/src/styles/theme.css and the
 * check constraint in migration 0015. An option offered here without a rule
 * there saves cleanly and then does nothing, which is the worst outcome.
 */
export interface RevealOption {
  value: string;
  label: string;
}

export const REVEAL_OPTIONS: RevealOption[] = [
  { value: '', label: 'Site default (fade up)' },
  { value: 'fade-up', label: 'Fade up' },
  { value: 'fade', label: 'Fade only' },
  { value: 'slide-left', label: 'Slide in from left' },
  { value: 'slide-right', label: 'Slide in from right' },
  { value: 'zoom', label: 'Zoom in' },
  { value: 'none', label: 'No animation' },
];

export const REVEAL_VALUES = REVEAL_OPTIONS.map((option) => option.value).filter(Boolean);
