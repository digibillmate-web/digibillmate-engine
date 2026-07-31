/**
 * Sample content for the "Auto Service & Repair" archetype.
 *
 * Development fixture only — it exists so the six block components can be
 * previewed without a Supabase round trip. Real sites get this data from
 * exported JSON. Field names here mirror `src/types/blocks.ts`.
 */
import type { BlockContent } from '../types/blocks';

export const autoServiceBlocks: BlockContent[] = [
  {
    type: 'hero',
    content: {
      eyebrow: 'Trusted since 2008',
      heading: 'Honest auto repair, done right the first time',
      subheading:
        'Full-service diagnostics, maintenance and bodywork. Same-day booking on most jobs, with a written quote before we touch anything.',
      image: { src: '/placeholders/hero.svg', alt: 'Workshop bay with a car on a lift' },
      primaryCta: { label: 'Book a service', href: '#contact' },
      secondaryCta: { label: 'See our prices', href: '#pricing' },
    },
  },
  {
    type: 'services_grid',
    content: {
      heading: 'What we do',
      intro: 'Everything your car needs under one roof, from a quick oil change to full panel work.',
      services: [
        { icon: '🔧', title: 'General servicing', description: 'Scheduled maintenance to manufacturer spec, logbook stamped.' },
        { icon: '🛞', title: 'Tyres & alignment', description: 'Fitting, balancing and four-wheel laser alignment.' },
        { icon: '🛑', title: 'Brakes & suspension', description: 'Pads, discs, shocks and springs — inspected free with any service.' },
        { icon: '⚙️', title: 'Engine diagnostics', description: 'Live fault-code reading across all major makes.' },
        { icon: '❄️', title: 'Air conditioning', description: 'Regas, leak testing and compressor replacement.' },
        { icon: '🚗', title: 'Bodywork & paint', description: 'Dent removal, resprays and colour-matched panel repair.' },
      ],
    },
  },
  {
    type: 'pricing_offers',
    content: {
      heading: 'Straightforward pricing',
      intro: 'No hidden fees. If the job changes, we call you before doing the work.',
      offers: [
        {
          name: 'Essential service',
          price: '$99',
          priceNote: 'from',
          description: 'Ideal for city driving and low annual mileage.',
          features: ['Oil & filter change', '25-point safety check', 'Fluid top-up', 'Tyre pressure & tread report'],
          cta: { label: 'Book essential', href: '#contact' },
        },
        {
          name: 'Full service',
          price: '$189',
          priceNote: 'from',
          description: 'Our most popular package for everyday drivers.',
          features: ['Everything in Essential', 'Air & cabin filter replacement', 'Brake inspection', 'Battery health test', '12-month roadside cover'],
          badge: 'Most popular',
          featured: true,
          cta: { label: 'Book full service', href: '#contact' },
        },
        {
          name: 'Brake replacement',
          price: '$149',
          priceNote: 'per axle',
          description: 'Pads and discs fitted, parts and labour included.',
          features: ['Premium pads & discs', 'Fluid level check', '2-year parts warranty'],
          cta: { label: 'Get a quote', href: '#contact' },
        },
      ],
    },
  },
  {
    type: 'before_after_gallery',
    content: {
      heading: 'Recent work',
      intro: 'A few jobs that came through the workshop this month.',
      items: [
        {
          before: { src: '/placeholders/before.svg', alt: 'Front bumper with deep scratches' },
          after: { src: '/placeholders/after.svg', alt: 'Front bumper resprayed and polished' },
          caption: 'Front bumper respray — two days, colour matched',
        },
        {
          before: { src: '/placeholders/before.svg', alt: 'Corroded brake discs' },
          after: { src: '/placeholders/after.svg', alt: 'New brake discs and pads fitted' },
          caption: 'Full brake overhaul on a 2015 hatchback',
        },
        {
          before: { src: '/placeholders/before.svg', alt: 'Dented rear quarter panel' },
          after: { src: '/placeholders/after.svg', alt: 'Repaired rear quarter panel' },
          caption: 'Paintless dent removal — same day turnaround',
        },
      ],
    },
  },
  {
    type: 'testimonials',
    content: {
      heading: 'What our customers say',
      items: [
        {
          quote: 'Quoted me half what the dealership wanted and finished a day early. They showed me the old parts too, which I appreciated.',
          author: 'Daniel R.',
          role: 'Servicing customer',
          rating: 5,
        },
        {
          quote: 'Called at 8am with a warning light, was back on the road by lunchtime. Clear explanation of what was wrong, no upselling.',
          author: 'Priya S.',
          role: 'Diagnostics customer',
          rating: 5,
        },
        {
          quote: 'The bodywork on my rear panel is invisible — you genuinely cannot tell it was ever hit.',
          author: 'Marcus T.',
          role: 'Bodywork customer',
          rating: 4,
        },
      ],
    },
  },
  {
    type: 'contact_location',
    content: {
      heading: 'Find us',
      intro: 'Drop in for a free visual inspection, or call ahead to reserve a bay.',
      address: '14 Industrial Way, Riverside, CA 92501',
      phone: '+1 (555) 014-8820',
      email: 'hello@example-autoshop.com',
      hours: [
        { days: 'Mon - Fri', time: '07:30 - 18:00' },
        { days: 'Saturday', time: '08:00 - 14:00' },
        { days: 'Sunday', time: 'Closed' },
      ],
      cta: { label: 'Call the workshop', href: 'tel:+15550148820' },
    },
  },
];
