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

export interface NavLink {
  label: string;
  href: string;
  /** Set by the export on the link pointing at the page being rendered. */
  current?: boolean;
}

/** header_nav */
export interface HeaderNavContent {
  businessName: string;
  logo?: Image;
  navLinks?: NavLink[];
  phone?: string;
  cta?: Cta;
}

/** floating_contact_bar */
export interface ContactChannel {
  label: string;
  url: string;
}

/** Channel keys are fixed so each can render its own icon; all are optional. */
export interface FloatingContactBarContent {
  call?: ContactChannel;
  whatsapp?: ContactChannel;
  facebook?: ContactChannel;
  instagram?: ContactChannel;
  youtube?: ContactChannel;
}

/** footer */
export interface FooterContent {
  businessName?: string;
  tagline?: string;
  servicesTitle?: string;
  services?: NavLink[];
  quickLinksTitle?: string;
  quickLinks?: NavLink[];
  contactTitle?: string;
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  qr?: Image;
  qrCaption?: string;
  copyright?: string;
}

/** about_section */
export interface AboutSectionContent {
  heading: string;
  body: string;
  image?: Image;
  readMore?: Cta;
}

/** brand_logos */
export interface Brand {
  name: string;
  logo?: Image;
}

export interface BrandLogosContent {
  heading?: string;
  brands: Brand[];
}

/** why_choose_us */
export interface Reason {
  /** Icon slug from a small fixed set (shield, clock, rupee, wrench, …). */
  icon?: string;
  title: string;
  description?: string;
}

export interface WhyChooseUsContent {
  heading?: string;
  reasons: Reason[];
}

/** hero */
export interface HeroSlide {
  image: Image;
  /** Optional destination when the whole slide is clickable. */
  link?: string;
}

export interface HeroContent {
  eyebrow?: string;
  heading: string;
  subheading?: string;
  /** Single banner image. Ignored when `slides` has entries. */
  image?: Image;
  /** Two or more slides render as a rotating carousel. */
  slides?: HeroSlide[];
  primaryCta?: Cta;
  secondaryCta?: Cta;
}

/** services_grid */
export interface Service {
  title: string;
  description?: string;
  /** Icon slug or emoji; used only when the service has no image. */
  icon?: string;
  href?: string;
  image?: Image;
  /** Plain amount, no symbol — the component prepends the currency. */
  price?: string | number;
}

export interface ServicesGridContent {
  heading: string;
  intro?: string;
  services: Service[];
  /** Currency symbol prepended to service prices. Defaults to ₹. */
  currency?: string;
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
  | { type: 'header_nav'; content: HeaderNavContent }
  | { type: 'floating_contact_bar'; content: FloatingContactBarContent }
  | { type: 'footer'; content: FooterContent }
  | { type: 'about_section'; content: AboutSectionContent }
  | { type: 'brand_logos'; content: BrandLogosContent }
  | { type: 'why_choose_us'; content: WhyChooseUsContent }
  | { type: 'hero'; content: HeroContent }
  | { type: 'services_grid'; content: ServicesGridContent }
  | { type: 'pricing_offers'; content: PricingOffersContent }
  | { type: 'gallery'; content: BeforeAfterGalleryContent }
  | { type: 'testimonials'; content: TestimonialsContent }
  | { type: 'contact'; content: ContactLocationContent };

export type BlockType = BlockContent['type'];
