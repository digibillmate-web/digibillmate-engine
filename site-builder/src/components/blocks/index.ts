/**
 * Block registry: one entry per Block Definition.
 *
 * The key must match `block_definitions.key` in Supabase. Renderers look a
 * block instance's type up here to find the component that draws it.
 */
import Hero from './Hero.astro';
import ServicesGrid from './ServicesGrid.astro';
import PricingOffers from './PricingOffers.astro';
import BeforeAfterGallery from './BeforeAfterGallery.astro';
import Testimonials from './Testimonials.astro';
import ContactLocation from './ContactLocation.astro';
import type { BlockType } from '../../types/blocks';

export const blockRegistry = {
  hero: Hero,
  services_grid: ServicesGrid,
  pricing_offers: PricingOffers,
  before_after_gallery: BeforeAfterGallery,
  testimonials: Testimonials,
  contact_location: ContactLocation,
} satisfies Record<BlockType, unknown>;

export {
  Hero,
  ServicesGrid,
  PricingOffers,
  BeforeAfterGallery,
  Testimonials,
  ContactLocation,
};
