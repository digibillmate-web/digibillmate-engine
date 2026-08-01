/**
 * Page slug rules, shared by the form and the server action.
 *
 * Deliberately not in page-actions.ts: a 'use server' module may only export
 * async functions, so pure helpers living there fail the build — and only at
 * runtime, since it is a Next.js constraint rather than a type error.
 */

/** URL-path shaped. Empty is reserved for the home page. */
export function validateSlug(value: string): string | null {
  if (!value) return 'Slug is required.';
  if (value.length > 60) return 'Slug must be 60 characters or fewer.';
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return 'Use lowercase letters, numbers and hyphens only, not starting or ending with a hyphen.';
  }
  return null;
}

/** Nudges typed input toward a valid slug rather than rejecting it. */
export function normaliseSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}
