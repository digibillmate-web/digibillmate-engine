/**
 * Content shapes for each Block Definition.
 *
 * These are the contract between Supabase (`block_instances.content`) and the
 * Astro components in `src/components/blocks/`. A block instance's stored JSON
 * must satisfy the matching interface below, and should validate against that
 * definition's `block_definitions.schema`.
 *
 * Keep the `type` string in sync with `block_definitions.key`.
 */

export interface Image {
  src: string;
  alt: string;
}

export interface Cta {
  label: string;
  href: string;
}

/** hero */
export interface HeroContent {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  image?: Image;
  primaryCta?: Cta;
  secondaryCta?: Cta;
}

/** services_grid */
export interface Service {
  title: string;
  description?: string;
  /** Icon slug or emoji; rendering is intentionally dumb for now. */
  icon?: string;
  href?: string;
}

export interface ServicesGridContent {
  heading: string;
  intro?: string;
  services: Service[];
}

/** pricing_offers */
export interface Offer {
  name: string;
  /** Plain amount, no symbol — the component prepends the currency. */
  price: string | number;
  /** e.g. "per axle", "starting from" */
  priceNote?: string;
  description?: string;
  features?: string[];
  /** e.g. "Most popular" */
  badge?: string;
  featured?: boolean;
  cta?: Cta;
}

export interface PricingOffersContent {
  heading: string;
  intro?: string;
  offers: Offer[];
  /**
   * Currency symbol prepended at render time. Defaults to ₹.
   * Stored prices stay symbol-free so a future archetype can set its own
   * without rewriting content.
   */
  currency?: string;
}

/** gallery */
export interface BeforeAfterItem {
  before: Image;
  after: Image;
  caption?: string;
}

export interface BeforeAfterGalleryContent {
  heading: string;
  intro?: string;
  items: BeforeAfterItem[];
}

/** testimonials */
export interface Testimonial {
  quote: string;
  author: string;
  role?: string;
  /** 1-5; omit to hide stars. */
  rating?: number;
  avatar?: Image;
}

export interface TestimonialsContent {
  heading: string;
  intro?: string;
  items: Testimonial[];
}

/** contact */
export interface OpeningHours {
  /** e.g. "Mon - Fri" */
  days: string;
  /** e.g. "08:00 - 18:00" or "Closed" */
  time: string;
}

export interface ContactLocationContent {
  heading: string;
  intro?: string;
  address?: string;
  phone?: string;
  email?: string;
  /** Free-text (as stored in Supabase) or a structured day/time table. */
  hours?: string | OpeningHours[];
  /** Embeddable map URL (iframe src). */
  mapEmbedUrl?: string;
  cta?: Cta;
}

/** Discriminated union of every block instance the engine can render. */
export type BlockContent =
  | { type: 'hero'; content: HeroContent }
  | { type: 'services_grid'; content: ServicesGridContent }
  | { type: 'pricing_offers'; content: PricingOffersContent }
  | { type: 'gallery'; content: BeforeAfterGalleryContent }
  | { type: 'testimonials'; content: TestimonialsContent }
  | { type: 'contact'; content: ContactLocationContent };

export type BlockType = BlockContent['type'];
