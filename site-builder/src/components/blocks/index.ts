/**
 * Block registry: one entry per Block Definition.
 *
 * The key must match `block_definitions.key` in Supabase. Renderers look a
 * block instance's type up here to find the component that draws it.
 */
import HeaderNav from './HeaderNav.astro';
import FloatingContactBar from './FloatingContactBar.astro';
import Footer from './Footer.astro';
import AboutSection from './AboutSection.astro';
import BrandLogos from './BrandLogos.astro';
import WhyChooseUs from './WhyChooseUs.astro';
import EnquiryForm from './EnquiryForm.astro';
import PageBanner from './PageBanner.astro';
import Hero from './Hero.astro';
import ServicesGrid from './ServicesGrid.astro';
import WorkProcess from './WorkProcess.astro';
import StatsBand from './StatsBand.astro';
import CategoryList from './CategoryList.astro';
import PricingOffers from './PricingOffers.astro';
import BeforeAfterGallery from './BeforeAfterGallery.astro';
import Testimonials from './Testimonials.astro';
import ContactLocation from './ContactLocation.astro';
import type { BlockType } from '../../types/blocks';

export const blockRegistry = {
  header_nav: HeaderNav,
  floating_contact_bar: FloatingContactBar,
  footer: Footer,
  about_section: AboutSection,
  brand_logos: BrandLogos,
  why_choose_us: WhyChooseUs,
  enquiry_form: EnquiryForm,
  page_banner: PageBanner,
  hero: Hero,
  services_grid: ServicesGrid,
  work_process: WorkProcess,
  stats_band: StatsBand,
  category_list: CategoryList,
  pricing_offers: PricingOffers,
  gallery: BeforeAfterGallery,
  testimonials: Testimonials,
  contact: ContactLocation,
} satisfies Record<BlockType, unknown>;

export {
  HeaderNav,
  FloatingContactBar,
  Footer,
  AboutSection,
  BrandLogos,
  WhyChooseUs,
  EnquiryForm,
  PageBanner,
  Hero,
  ServicesGrid,
  PricingOffers,
  BeforeAfterGallery,
  Testimonials,
  ContactLocation,
};
