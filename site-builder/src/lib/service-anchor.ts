/**
 * Anchor id for one service.
 *
 * Shared because two places must agree on it: the detail page puts it on the
 * section, and the home page's summary card links to it. Derived from the
 * title rather than an index so reordering the services does not silently
 * repoint every existing link.
 */
export function serviceAnchor(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // A title of only punctuation would otherwise produce href="#", which
  // scrolls to the top of the page and looks like a broken link.
  return slug ? `service-${slug}` : '';
}
