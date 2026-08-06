/**
 * Theme tokens.
 *
 * Stored bare ("color-primary"), exactly as archetypes.default_theme holds
 * them. The export pipeline prefixes them to --dbm-* CSS custom properties;
 * nothing in the database knows about CSS.
 */

export type TokenKind = 'color' | 'font' | 'image' | 'text' | 'number' | 'choice';

export type TokenGroup = 'Brand' | 'Page' | 'Typography' | 'Motion' | 'Site';

export interface TokenSpec {
  key: string;
  label: string;
  kind: TokenKind;
  group: TokenGroup;
  hint?: string;
  /** Bounds for kind: 'number'. */
  min?: number;
  max?: number;
  step?: number;
  /** For kind: 'choice' — value/label pairs, first being the default. */
  options?: { value: string; label: string }[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
  'Brand',
  'Page',
  'Typography',
  'Motion',
  'Site',
];

/**
 * The tokens the site-builder components actually consume.
 *
 * Every one of these is read by a component through a --dbm-* custom
 * property. Adding a token here without a component reading it produces a
 * control that appears to do nothing, so the list is deliberately not a
 * superset of "colours we could imagine offering".
 */
export const THEME_TOKENS: TokenSpec[] = [
  // --- Brand -------------------------------------------------------------
  {
    key: 'color-primary',
    label: 'Primary',
    kind: 'color',
    group: 'Brand',
    hint: 'Buttons, prices, links, accents',
  },
  {
    key: 'color-primary-contrast',
    label: 'Text on primary',
    kind: 'color',
    group: 'Brand',
    hint: 'Button label colour — keep it readable against Primary',
  },
  {
    key: 'color-secondary',
    label: 'Secondary',
    kind: 'color',
    group: 'Brand',
    hint: 'Footer and other dark surfaces',
  },
  {
    key: 'color-secondary-contrast',
    label: 'Text on secondary',
    kind: 'color',
    group: 'Brand',
    hint: 'Footer text colour',
  },

  // --- Page --------------------------------------------------------------
  {
    key: 'color-background',
    label: 'Background',
    kind: 'color',
    group: 'Page',
    hint: 'Main page background',
  },
  {
    key: 'color-surface',
    label: 'Surface',
    kind: 'color',
    group: 'Page',
    hint: 'Alternating section bands and cards',
  },
  {
    key: 'color-border',
    label: 'Border',
    kind: 'color',
    group: 'Page',
    hint: 'Card outlines and dividers',
  },
  { key: 'color-text', label: 'Text', kind: 'color', group: 'Page', hint: 'Body copy' },
  {
    key: 'color-text-muted',
    label: 'Muted text',
    kind: 'color',
    group: 'Page',
    hint: 'Descriptions, captions, secondary copy',
  },

  // --- Typography ---------------------------------------------------------
  {
    key: 'font-heading',
    label: 'Heading font',
    kind: 'font',
    group: 'Typography',
    hint: 'Headings and the logo text',
  },
  {
    key: 'font-body',
    label: 'Body font',
    kind: 'font',
    group: 'Typography',
    hint: 'Paragraphs, buttons and navigation',
  },

  // --- Motion -------------------------------------------------------------
  {
    key: 'slide-seconds',
    label: 'Slide speed',
    kind: 'number',
    group: 'Motion',
    min: 2,
    max: 12,
    step: 0.5,
    hint: 'Seconds each hero slide and carousel card holds before the next one. Lower is faster.',
  },

  {
    key: 'preloader',
    label: 'Loading screen',
    kind: 'choice',
    group: 'Motion',
    options: [
      { value: '', label: 'None' },
      { value: 'ring', label: 'Spinning ring' },
    ],
    hint: 'Covers the page while it loads. Clears itself even if scripts fail.',
  },
  {
    key: 'cursor-glow',
    label: 'Cursor glow',
    kind: 'choice',
    group: 'Motion',
    options: [
      { value: '', label: 'None' },
      { value: 'soft', label: 'Soft' },
      { value: 'strong', label: 'Strong' },
    ],
    hint: 'A halo trailing the mouse. Desktop only — ignored on touch screens.',
  },

  // --- Site ---------------------------------------------------------------
  {
    key: 'favicon-url',
    label: 'Favicon',
    kind: 'image',
    group: 'Site',
    hint: 'Small square image shown in the browser tab',
  },
  {
    key: 'seo-title',
    label: 'Browser tab title',
    kind: 'text',
    group: 'Site',
    hint: 'Shown in the tab and in search results. Defaults to the header business name.',
  },
  {
    key: 'seo-description',
    label: 'Search description',
    kind: 'text',
    group: 'Site',
    hint: 'The summary search engines show under the title.',
  },
];

export type ThemeValues = Record<string, string>;

/**
 * What a site actually renders with: its own values layered over the
 * archetype's defaults. Mirrors the merge the export pipeline performs, so
 * the editor shows what the built site will look like rather than a
 * half-empty form.
 */
export function effectiveTheme(
  archetypeDefaults: unknown,
  siteTheme: unknown,
  themeLinked: boolean,
): ThemeValues {
  const defaults = asStringMap(archetypeDefaults);
  if (themeLinked) return defaults;
  return { ...defaults, ...asStringMap(siteTheme) };
}

function asStringMap(value: unknown): ThemeValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
}

/** Fonts are stored as a full CSS stack; the first family is the readable name. */
export function primaryFamily(stack: string): string {
  return (stack.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');
}

/** A hex colour the <input type="color"> control can accept, or null. */
export function toColorInputValue(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  // Named colours and rgb() are valid CSS but not valid for the picker.
  return null;
}
