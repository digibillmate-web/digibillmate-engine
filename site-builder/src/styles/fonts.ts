/**
 * Self-hosted webfont catalog.
 *
 * Archetype themes name font families as plain CSS values ("Poppins,
 * sans-serif"), so the families they can reference must be bundled ahead of
 * time — a static import is what lets Vite fingerprint and emit the woff2
 * files into dist/. Nothing is fetched at page load; the built site is a
 * self-contained artifact.
 *
 * This list is the source of truth for the font picker in the admin portal
 * (admin-tool/src/lib/fonts.ts). Adding a family means adding it in both
 * places — otherwise the picker offers a font the built site cannot render.
 */

// Sans — UI and body text
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

import '@fontsource/poppins/400.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';

import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';

import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';

import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';

import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';

import '@fontsource/raleway/400.css';
import '@fontsource/raleway/600.css';
import '@fontsource/raleway/700.css';

// Display — headings with more personality
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';

// Serif
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
