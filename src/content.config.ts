import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const places = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/places' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    category: z.string(),                  // matches a slug in categories.json
    lat: z.number(),
    lon: z.number(),
    address: z.string().optional(),
    phone: z.string().optional(),
    links: z.object({
      google_maps: z.string().url().optional(),
      website: z.string().url().optional(),
      instagram: z.string().optional(),
    }).default({}),
    hero: z.string().optional(),
    hero_credit: z.string().optional(),
    source: z.string().default('manual'),
    google_category: z.string().optional(),
    tags: z.string().optional(),
    comment: z.string().optional(),
  }),
});

export const collections = { places };
