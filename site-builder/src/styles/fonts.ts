/**
 * Self-hosted webfont catalog.
 *
 * Archetype themes name font families as plain CSS values ("Poppins,
 * sans-serif"), so the families they can reference must be bundled ahead of
 * time — a static import is what lets Vite fingerprint and emit the woff2
 * files into dist/. Nothing is fetched at page load; the built site is a
 * self-contained artifact.
 *
 * Adding a family to an archetype's default_theme means adding it here too.
 */
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
