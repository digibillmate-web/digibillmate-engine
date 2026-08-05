/**
 * Fonts the built site can actually render.
 *
 * Mirrors site-builder/src/styles/fonts.ts, which self-hosts these families.
 * Offering a font here that is not bundled there would produce a theme the
 * site silently falls back from, so the two lists must move together.
 */

export interface FontOption {
  /** Full CSS stack, stored verbatim in the theme. */
  value: string;
  label: string;
  group: 'Sans' | 'Display' | 'Serif';
}

export const FONT_OPTIONS: FontOption[] = [
  { value: '"Plus Jakarta Sans", sans-serif', label: 'Plus Jakarta Sans', group: 'Sans' },
  { value: 'Inter, sans-serif', label: 'Inter', group: 'Sans' },
  { value: 'Poppins, sans-serif', label: 'Poppins', group: 'Sans' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat', group: 'Sans' },
  { value: 'Roboto, sans-serif', label: 'Roboto', group: 'Sans' },
  { value: '"Open Sans", sans-serif', label: 'Open Sans', group: 'Sans' },
  { value: 'Lato, sans-serif', label: 'Lato', group: 'Sans' },
  { value: 'Nunito, sans-serif', label: 'Nunito', group: 'Sans' },
  { value: 'Raleway, sans-serif', label: 'Raleway', group: 'Sans' },
  { value: 'Oswald, sans-serif', label: 'Oswald', group: 'Display' },
  { value: '"Playfair Display", serif', label: 'Playfair Display', group: 'Serif' },
  {
    value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    label: 'System default (no download)',
    group: 'Sans',
  },
];

export const FONT_GROUPS = ['Sans', 'Display', 'Serif'] as const;

/** True when a stored value is one of the offered options. */
export function isKnownFont(value: string): boolean {
  return FONT_OPTIONS.some((option) => option.value === value.trim());
}
