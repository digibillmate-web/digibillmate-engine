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
  /** Top-to-bottom order. Anything omitted follows, in the default order. */
  order?: string[];
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
  /** Height of the full-width band variant. Defaults to 'medium'. */
  bandHeight?: 'short' | 'medium' | 'tall' | 'full';
}

/** brand_logos */
export interface Brand {
  name: string;
  logo?: Image;
}

export interface BrandLogosContent {
  heading?: string;
  brands: Brand[];
  /** 'marquee' scrolls the strip continuously. Defaults to 'grid'. */
  layout?: 'grid' | 'marquee';
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
  /** Sits between the two columns of reasons on a wide screen. */
  image?: Image;
}

/** page_banner */
export interface BreadcrumbStep {
  label: string;
  href?: string;
}

export interface PageBannerContent {
  /** Blank falls back to the page title, filled in by the renderer. */
  title: string;
  subtitle?: string;
  image?: Image;
  /** Built by the renderer, which is the only place the page is known. */
  breadcrumb?: BreadcrumbStep[];
  showBreadcrumb?: boolean;
}

/** enquiry_form */
export interface EnquiryFormContent {
  title: string;
  intro?: string;
  /** Digits only after normalising; empty falls back to email. */
  whatsappNumber?: string;
  email?: string;
  submitLabel?: string;
  serviceOptions?: string[];
  footnote?: string;
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

/**
 * 'rail' is the scrolling row of cards used as a summary; 'detail' is the
 * full-width alternating image/text stack a services page is made of. Same
 * services either way — one list of services, two presentations of it.
 */
export type ServicesLayout = 'rail' | 'detail';

export interface ServicesGridContent {
  heading: string;
  intro?: string;
  services: Service[];
  /** Currency symbol prepended to service prices. Defaults to ₹. */
  currency?: string;
  /** Defaults to 'rail'. */
  layout?: ServicesLayout;
  /**
   * Where a service's enquire button goes. Filled at render time from the
   * page carrying the enquiry form, so it is absent when the site has none
   * and no button is drawn rather than one that leads nowhere.
   */
  enquiryHref?: string;
}

/** stats_band */
export interface Stat {
  value: string;
  label: string;
  /** Optional qualifier under the label. */
  note?: string;
}

export interface StatsBandContent {
  title?: string;
  intro?: string;
  stats: Stat[];
}

/** work_process */
export interface ProcessStep {
  title: string;
  description?: string;
  /** Icon slug or emoji; the step number is drawn either way. */
  icon?: string;
}

export interface WorkProcessContent {
  title: string;
  intro?: string;
  steps: ProcessStep[];
}

/** category_list */
export interface CategoryItem {
  label: string;
  /** Secondary line — a price, a lead time, a qualifier. */
  note?: string;
}

export interface Category {
  title: string;
  icon?: string;
  image?: Image;
  items: CategoryItem[];
}

export interface CategoryListContent {
  title: string;
  intro?: string;
  categories: Category[];
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
  | { type: 'stats_band'; content: StatsBandContent }
  | { type: 'work_process'; content: WorkProcessContent }
  | { type: 'category_list'; content: CategoryListContent }
  | { type: 'pricing_offers'; content: PricingOffersContent }
  | { type: 'gallery'; content: BeforeAfterGalleryContent }
  | { type: 'testimonials'; content: TestimonialsContent }
  | { type: 'contact'; content: ContactLocationContent }
  | { type: 'enquiry_form'; content: EnquiryFormContent }
  | { type: 'page_banner'; content: PageBannerContent };

export type BlockType = BlockContent['type'];
