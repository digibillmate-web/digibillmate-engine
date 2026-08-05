/**
 * Which theme tokens each block type actually reads.
 *
 * The point is visibility: from the Theme tab alone there is no way to tell
 * which sections a colour change will touch. This maps each block to the
 * tokens its component genuinely uses, so the editor can show that inline.
 *
 * Kept in step with the components by hand. A token listed here that the
 * component does not read is worse than an omission, because it claims an
 * effect the site will not show.
 */

export type TokenKey =
  | 'color-primary'
  | 'color-primary-contrast'
  | 'color-secondary'
  | 'color-secondary-contrast'
  | 'color-background'
  | 'color-surface'
  | 'color-border'
  | 'color-text'
  | 'color-text-muted'
  | 'font-heading'
  | 'font-body';

/** Tokens every block inherits through body and the shared primitives. */
const BASE: TokenKey[] = ['color-background', 'color-text', 'font-body'];

export const BLOCK_TOKENS: Record<string, TokenKey[]> = {
  header_nav: [
    ...BASE,
    'color-primary',
    'color-border',
    'color-secondary',
    'color-secondary-contrast',
    'font-heading',
  ],
  hero: [...BASE, 'color-primary', 'color-primary-contrast', 'color-secondary', 'font-heading'],
  page_banner: ['color-secondary', 'color-secondary-contrast', 'color-primary', 'font-heading'],
  about_section: [...BASE, 'color-primary', 'color-text-muted', 'font-heading'],
  services_grid: [
    ...BASE,
    'color-primary',
    'color-border',
    'color-text-muted',
    'font-heading',
  ],
  pricing_offers: [...BASE, 'color-primary', 'color-border', 'color-text-muted', 'font-heading'],
  brand_logos: [...BASE, 'color-surface', 'color-border', 'color-text-muted', 'font-heading'],
  why_choose_us: [
    ...BASE,
    'color-primary',
    'color-primary-contrast',
    'color-border',
    'color-text-muted',
    'font-heading',
  ],
  gallery: [...BASE, 'color-primary', 'color-secondary', 'color-text-muted', 'font-heading'],
  testimonials: [...BASE, 'color-primary', 'color-surface', 'color-border', 'font-heading'],
  contact: [...BASE, 'color-primary', 'color-border', 'color-text-muted', 'font-heading'],
  enquiry_form: [...BASE, 'color-primary', 'color-border', 'color-text-muted', 'font-heading'],
  footer: ['color-secondary', 'color-secondary-contrast', 'color-primary', 'font-heading'],
  floating_contact_bar: [],
};

export function tokensFor(blockKey: string): TokenKey[] {
  return BLOCK_TOKENS[blockKey] ?? BASE;
}

export function isFontToken(token: TokenKey): boolean {
  return token.startsWith('font-');
}

/** "color-text-muted" -> "Muted text" reads better than the raw key. */
const LABELS: Partial<Record<TokenKey, string>> = {
  'color-primary': 'Primary',
  'color-primary-contrast': 'Text on primary',
  'color-secondary': 'Secondary',
  'color-secondary-contrast': 'Text on secondary',
  'color-background': 'Background',
  'color-surface': 'Surface',
  'color-border': 'Border',
  'color-text': 'Text',
  'color-text-muted': 'Muted text',
  'font-heading': 'Heading font',
  'font-body': 'Body font',
};

export function tokenLabel(token: TokenKey): string {
  return LABELS[token] ?? token;
}
