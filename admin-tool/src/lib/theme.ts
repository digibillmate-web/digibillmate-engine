/**
 * Theme tokens.
 *
 * Stored bare ("color-primary"), exactly as archetypes.default_theme holds
 * them. The export pipeline prefixes them to --dbm-* CSS custom properties;
 * nothing in the database knows about CSS.
 */

export type TokenKind = 'color' | 'font' | 'image';

export interface TokenSpec {
  key: string;
  label: string;
  kind: TokenKind;
  hint?: string;
}

/**
 * The tokens the site-builder components actually consume. Kept in this order
 * because it reads as a hierarchy: brand colour first, surfaces after.
 */
export const THEME_TOKENS: TokenSpec[] = [
  { key: 'color-primary', label: 'Primary', kind: 'color', hint: 'Buttons, prices, accents' },
  { key: 'color-secondary', label: 'Secondary', kind: 'color', hint: 'Footer, dark surfaces' },
  { key: 'color-background', label: 'Background', kind: 'color', hint: 'Page background' },
  { key: 'color-text', label: 'Text', kind: 'color', hint: 'Body copy' },
  { key: 'font-heading', label: 'Heading font', kind: 'font', hint: 'e.g. Poppins, sans-serif' },
  { key: 'font-body', label: 'Body font', kind: 'font', hint: 'e.g. Inter, sans-serif' },
  {
    key: 'favicon-url',
    label: 'Favicon',
    kind: 'image',
    hint: 'Small square image shown in the browser tab',
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
