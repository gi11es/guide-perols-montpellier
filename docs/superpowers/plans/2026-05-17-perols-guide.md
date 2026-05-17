# Pérols Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, mobile-first French guide of the author's favorite places within 100km of Pérols, with editorial design and an interactive MapLibre map, deployed to Cloudflare Pages.

**Architecture:** Astro static site with content collections (one Markdown file per place). MapLibre GL renders self-hosted Protomaps vector tiles for the region. Two pipeline scripts (`import-takeout`, `fetch-photos`) automate content creation from Google Takeout. Editorial design system (Fraunces + Inter, bone/terracotta palette) defined in CSS variables.

**Tech Stack:** Astro 4, TypeScript, MapLibre GL JS, pmtiles, Vitest (for pipeline-script tests), Cloudflare Pages.

**Testing approach:**
- **Logic-heavy scripts** (URL coord extraction, radius filter, Takeout parsing) — strict TDD with Vitest unit tests.
- **Astro components / visual UI** — success criteria defined per task ("dev server shows X"); verified by running the dev server and inspecting in a mobile-viewport browser. Each task lists exact verification commands and what to look for.

---

## File Structure

```
guide-perols-montpellier/
├─ package.json
├─ tsconfig.json
├─ astro.config.mjs
├─ vitest.config.ts
├─ .gitignore
├─ .env.example
├─ README.md
├─ public/
│  ├─ robots.txt
│  ├─ favicon.svg
│  ├─ fonts/                    # self-hosted later if needed
│  ├─ photos/                   # populated by scripts/fetch-photos.mjs
│  ├─ tiles/perols-100km.pmtiles  # produced by scripts/build-tiles.mjs
│  └─ map-style.json
├─ src/
│  ├─ content/
│  │  ├─ config.ts              # Zod schemas for collections
│  │  ├─ places/                # one .md per place
│  │  │  └─ exemple-place.md    # seed example for early tasks
│  │  ├─ categories.json
│  │  └─ pratique.md
│  ├─ layouts/
│  │  └─ Base.astro
│  ├─ components/
│  │  ├─ Map.astro              # MapLibre wrapper (client:only)
│  │  ├─ PlaceSheet.astro
│  │  ├─ PlaceCard.astro
│  │  ├─ CategoryChips.astro
│  │  └─ Links.astro
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ place/[slug].astro
│  │  ├─ category/[slug].astro
│  │  └─ pratique.astro
│  ├─ styles/
│  │  ├─ tokens.css             # CSS variables: colors, type, spacing
│  │  └─ global.css             # base, resets, layouts
│  └─ lib/
│     ├─ geo.ts                 # haversine + bbox helpers
│     ├─ slug.ts                # slugify
│     └─ url.ts                 # Google Maps URL coord extraction
├─ scripts/
│  ├─ import-takeout.mjs
│  ├─ fetch-photos.mjs
│  └─ build-tiles.mjs
├─ tests/
│  ├─ url.test.ts
│  ├─ geo.test.ts
│  └─ import-takeout.test.ts
└─ data/
   └─ takeout/                  # user's export, gitignored
```

**Boundaries:**
- `src/lib/*` — pure TypeScript utilities, fully unit-tested, no Astro imports.
- `src/components/*` — Astro components, presentational. Map component is the only client-side JS island.
- `scripts/*` — Node ES modules. Use `src/lib/*` helpers (re-imported as `.ts` via tsx or compiled — Task 1 sets up tsx).
- `src/content/*` — content authoring. Schema enforced by `src/content/config.ts`.

---

## Task 1: Scaffold Astro project

**Files:**
- Create: `package.json`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`
- Create: `src/pages/index.astro`, `src/layouts/Base.astro`

- [ ] **Step 1: Initialize `package.json`**

Create `/Users/gilles/Documents/personal/guide-perols-montpellier/package.json`:
```json
{
  "name": "guide-perols-montpellier",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "import": "tsx scripts/import-takeout.mjs",
    "photos": "tsx scripts/fetch-photos.mjs",
    "build-tiles": "tsx scripts/build-tiles.mjs"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd /Users/gilles/Documents/personal/guide-perols-montpellier
npm install astro @astrojs/check typescript
npm install -D vitest tsx @types/node
```

Expected: `node_modules/` populated, no errors. `package.json` gains `dependencies` and `devDependencies`.

- [ ] **Step 3: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["src/*"]
    }
  },
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Configure Astro**

Create `astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://guide-perols-montpellier.pages.dev',
  trailingSlash: 'never',
  build: { format: 'directory' },
});
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '~': new URL('./src', import.meta.url).pathname },
  },
});
```

- [ ] **Step 6: Add `.gitignore`**

Create `.gitignore`:
```
node_modules/
dist/
.astro/
.env
.env.local
data/takeout/
public/tiles/*.pmtiles
public/photos/
*.log
.DS_Store
```

- [ ] **Step 7: Add `.env.example`**

Create `.env.example`:
```
# Author's house coordinates for the 100km radius filter.
HOUSE_LAT=43.5650
HOUSE_LON=3.9450

# Optional: Google Places API key. If unset, photo fetching falls back to Wikimedia only.
GOOGLE_PLACES_API_KEY=
```

- [ ] **Step 8: Create Base layout and minimal index**

Create `src/layouts/Base.astro`:
```astro
---
interface Props {
  title: string;
  description?: string;
}
const { title, description = 'Guide personnel de la région de Pérols' } = Astro.props;
---
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

Create `src/pages/index.astro`:
```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="Guide de Pérols">
  <main>
    <h1>Guide de Pérols</h1>
    <p>En construction.</p>
  </main>
</Base>
```

- [ ] **Step 9: Verify dev server runs**

Run: `npm run dev`
Expected: server starts on `http://localhost:4321/`. Open it; you should see "Guide de Pérols" / "En construction." Stop with Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "Scaffold Astro project"
```

---

## Task 2: Pure-logic utilities with unit tests

**Files:**
- Create: `src/lib/geo.ts`, `src/lib/slug.ts`, `src/lib/url.ts`
- Create: `tests/geo.test.ts`, `tests/url.test.ts`, `tests/slug.test.ts`

- [ ] **Step 1: Write failing test for haversine distance**

Create `tests/geo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { haversineKm, withinRadiusKm } from '~/lib/geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 43.5650, lon: 3.9450 }, { lat: 43.5650, lon: 3.9450 })).toBe(0);
  });

  it('computes Pérols → Nîmes (~45km) within 2km tolerance', () => {
    const perols = { lat: 43.5650, lon: 3.9450 };
    const nimes = { lat: 43.8367, lon: 4.3601 };
    const d = haversineKm(perols, nimes);
    expect(d).toBeGreaterThan(43);
    expect(d).toBeLessThan(47);
  });

  it('computes Pérols → Paris (~600km, well beyond 100km)', () => {
    const perols = { lat: 43.5650, lon: 3.9450 };
    const paris = { lat: 48.8566, lon: 2.3522 };
    expect(haversineKm(perols, paris)).toBeGreaterThan(500);
  });
});

describe('withinRadiusKm', () => {
  const perols = { lat: 43.5650, lon: 3.9450 };
  it('returns true for self', () => {
    expect(withinRadiusKm(perols, perols, 100)).toBe(true);
  });
  it('returns true for Nîmes within 100km', () => {
    expect(withinRadiusKm(perols, { lat: 43.8367, lon: 4.3601 }, 100)).toBe(true);
  });
  it('returns false for Paris beyond 100km', () => {
    expect(withinRadiusKm(perols, { lat: 48.8566, lon: 2.3522 }, 100)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- geo`
Expected: FAIL — "Cannot find module '~/lib/geo'".

- [ ] **Step 3: Implement `src/lib/geo.ts`**

```ts
export interface LatLon { lat: number; lon: number; }

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export function withinRadiusKm(origin: LatLon, point: LatLon, radiusKm: number): boolean {
  return haversineKm(origin, point) <= radiusKm;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- geo`
Expected: PASS — all 5 cases.

- [ ] **Step 5: Write failing test for URL coordinate extraction**

Create `tests/url.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { extractCoordsFromGmapsUrl } from '~/lib/url';

describe('extractCoordsFromGmapsUrl', () => {
  it('extracts from !3d!4d pattern', () => {
    const url = 'https://www.google.com/maps/place/Foo/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d43.5709!4d3.9519!16s';
    expect(extractCoordsFromGmapsUrl(url)).toEqual({ lat: 43.5709, lon: 3.9519 });
  });

  it('extracts from @lat,lon, pattern', () => {
    const url = 'https://www.google.com/maps/place/Foo/@43.5709,3.9519,17z';
    expect(extractCoordsFromGmapsUrl(url)).toEqual({ lat: 43.5709, lon: 3.9519 });
  });

  it('extracts from q=lat,lon query param', () => {
    const url = 'https://www.google.com/maps?q=43.5709,3.9519';
    expect(extractCoordsFromGmapsUrl(url)).toEqual({ lat: 43.5709, lon: 3.9519 });
  });

  it('returns null when no coords found', () => {
    expect(extractCoordsFromGmapsUrl('https://www.google.com/maps/place/Foo')).toBeNull();
  });

  it('returns null for non-google URL', () => {
    expect(extractCoordsFromGmapsUrl('https://example.com')).toBeNull();
  });
});
```

- [ ] **Step 6: Run test to verify failure**

Run: `npm test -- url`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `src/lib/url.ts`**

```ts
import type { LatLon } from './geo';

export function extractCoordsFromGmapsUrl(url: string): LatLon | null {
  if (!/google\.[a-z.]+\/maps/.test(url) && !url.includes('maps.app.goo.gl')) {
    return null;
  }
  // Try !3d<lat>!4d<lon> pattern (most common in saved-place URLs)
  const dm = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dm) return { lat: parseFloat(dm[1]), lon: parseFloat(dm[2]) };
  // Try @lat,lon, pattern
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: parseFloat(at[1]), lon: parseFloat(at[2]) };
  // Try q=lat,lon query
  const q = url.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) return { lat: parseFloat(q[1]), lon: parseFloat(q[2]) };
  return null;
}

export async function resolveShortUrl(url: string): Promise<string> {
  // Follow redirects for maps.app.goo.gl short URLs.
  const res = await fetch(url, { redirect: 'follow' });
  return res.url;
}
```

- [ ] **Step 8: Run url test to verify pass**

Run: `npm test -- url`
Expected: PASS — all 5 cases.

- [ ] **Step 9: Write failing test for slugify**

Create `tests/slug.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { slugify } from '~/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Le Petit Bouchon')).toBe('le-petit-bouchon');
  });
  it('strips French diacritics', () => {
    expect(slugify('Café de la Plage')).toBe('cafe-de-la-plage');
    expect(slugify('Crêperie Bretonne — Sète')).toBe('creperie-bretonne-sete');
  });
  it('collapses repeated separators', () => {
    expect(slugify('  A  &  B  ')).toBe('a-b');
  });
  it('keeps numbers', () => {
    expect(slugify('Bar 24')).toBe('bar-24');
  });
});
```

- [ ] **Step 10: Run test to verify failure**

Run: `npm test -- slug`
Expected: FAIL.

- [ ] **Step 11: Implement `src/lib/slug.ts`**

```ts
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')          // non-alnum → hyphen
    .replace(/^-+|-+$/g, '');             // trim hyphens
}
```

- [ ] **Step 12: Run all tests, verify pass**

Run: `npm test`
Expected: PASS — all geo + url + slug cases.

- [ ] **Step 13: Commit**

```bash
git add .
git commit -m "Add geo, url, slug utilities with unit tests"
```

---

## Task 3: Content collections schema and seed content

**Files:**
- Create: `src/content/config.ts`
- Create: `src/content/categories.json`
- Create: `src/content/places/exemple-place.md`
- Create: `src/content/pratique.md`

- [ ] **Step 1: Define content collections**

Create `src/content/config.ts`:
```ts
import { defineCollection, z } from 'astro:content';

const places = defineCollection({
  type: 'content',
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
  }),
});

export const collections = { places };
```

- [ ] **Step 2: Create categories.json with seed taxonomy**

Create `src/content/categories.json`:
```json
[
  { "slug": "restaurant", "label": "Restaurants", "color": "#7A8B3A", "order": 1 },
  { "slug": "cafe-bar", "label": "Cafés & Bars", "color": "#B5743A", "order": 2 },
  { "slug": "plage", "label": "Plages", "color": "#4A7C8F", "order": 3 },
  { "slug": "nature", "label": "Nature & Parcs", "color": "#A88C3A", "order": 4 },
  { "slug": "culture", "label": "Culture & Art", "color": "#B5667A", "order": 5 },
  { "slug": "boutique", "label": "Boutiques & Marchés", "color": "#5F5F5F", "order": 6 }
]
```

Note: this is the seed taxonomy. It will be revised during the interactive categorization quiz once Takeout data is parsed.

- [ ] **Step 3: Create seed example place**

Create `src/content/places/exemple-place.md`:
```yaml
---
name: "L'Étang du Méjean"
slug: etang-du-mejean
category: nature
lat: 43.567
lon: 3.917
address: "Lattes, Hérault"
links:
  google_maps: "https://maps.google.com/?q=43.567,3.917"
source: "manual"
google_category: "Nature reserve"
---
Un étang juste à côté, parfait au lever et au coucher du soleil pour voir les flamants roses. Garer la voiture au petit parking, marcher 5 minutes vers l'observatoire.
```

- [ ] **Step 4: Create empty pratique.md**

Create `src/data/pratique.md` (outside `src/content/` to keep it out of the content collections system):
```markdown
# Pratique

## Urgences
- **15** — SAMU (urgences médicales)
- **17** — Police / Gendarmerie
- **18** — Pompiers
- **112** — Numéro européen d'urgence

## Médecin
À remplir.

## Pharmacie
À remplir.

## Taxi / VTC
À remplir.

## Wi-Fi
À remplir.
```

- [ ] **Step 5: Run astro check to validate schema**

Run: `npm run check`
Expected: PASS — no schema errors. The example place validates.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "Add content collections schema and seed content"
```

---

## Task 4: Design tokens and typography

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`
- Modify: `src/layouts/Base.astro`

- [ ] **Step 1: Define CSS tokens**

Create `src/styles/tokens.css`:
```css
:root {
  /* Colors */
  --color-bg: #F4EFE6;
  --color-ink: #1A1814;
  --color-ink-soft: #5C544A;
  --color-accent: #C25B3F;
  --color-rule: rgba(26, 24, 20, 0.12);

  /* Category swatches (mirror categories.json) */
  --cat-restaurant: #7A8B3A;
  --cat-cafe-bar: #B5743A;
  --cat-plage: #4A7C8F;
  --cat-nature: #A88C3A;
  --cat-culture: #B5667A;
  --cat-boutique: #5F5F5F;

  /* Type */
  --font-serif: 'Fraunces', Georgia, 'Times New Roman', serif;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;

  --fs-xs: 12px;
  --fs-sm: 14px;
  --fs-base: 16px;
  --fs-lg: 19px;
  --fs-xl: 24px;
  --fs-2xl: 34px;
  --fs-3xl: 48px;

  --lh-tight: 1.1;
  --lh-snug: 1.25;
  --lh-normal: 1.5;
  --lh-loose: 1.7;

  /* Space */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;
  --space-9: 64px;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;
}
```

- [ ] **Step 2: Global styles + Google Fonts**

Create `src/styles/global.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap');

@import './tokens.css';

*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-sans);
  font-size: var(--fs-base);
  line-height: var(--lh-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

h1, h2, h3, h4 {
  font-family: var(--font-serif);
  font-weight: 400;
  line-height: var(--lh-tight);
  margin: 0 0 var(--space-4);
  letter-spacing: -0.01em;
}
h1 { font-size: var(--fs-3xl); font-weight: 500; }
h2 { font-size: var(--fs-2xl); }
h3 { font-size: var(--fs-xl); }

p { margin: 0 0 var(--space-4); }

a {
  color: var(--color-accent);
  text-decoration: none;
  border-bottom: 1px solid currentColor;
}
a:hover { opacity: 0.8; }

img { max-width: 100%; display: block; }

.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 var(--space-5);
}

.muted { color: var(--color-ink-soft); }
.eyebrow {
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-ink-soft);
}
```

- [ ] **Step 3: Import styles from Base layout**

Modify `src/layouts/Base.astro`:
```astro
---
import '~/styles/global.css';
interface Props {
  title: string;
  description?: string;
}
const { title, description = 'Guide personnel de la région de Pérols' } = Astro.props;
---
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

- [ ] **Step 4: Update index to use tokens**

Modify `src/pages/index.astro`:
```astro
---
import Base from '~/layouts/Base.astro';
---
<Base title="Guide de Pérols">
  <main class="container" style="padding-top: var(--space-9); padding-bottom: var(--space-9);">
    <p class="eyebrow">Un guide personnel</p>
    <h1>Pérols & autour</h1>
    <p class="muted">Nos endroits préférés à 100 km autour de la maison.</p>
  </main>
</Base>
```

- [ ] **Step 5: Visually verify**

Run: `npm run dev`
Open `http://localhost:4321/` in a browser with mobile viewport (375×812). Expected:
- Bone/cream background.
- "Un guide personnel" eyebrow, small uppercase, muted.
- Large Fraunces "Pérols & autour" heading.
- Muted-grey subhead in Inter.
- No layout shifts, fonts load.

Stop server with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "Add design tokens, typography, and base layout styles"
```

---

## Task 5: PlaceCard component and list-only home page

**Files:**
- Create: `src/components/PlaceCard.astro`, `src/components/Links.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create Links component**

Create `src/components/Links.astro`:
```astro
---
interface Props {
  links: {
    google_maps?: string;
    website?: string;
    instagram?: string;
  };
}
const { links } = Astro.props;
const instagramUrl = links.instagram
  ? `https://instagram.com/${links.instagram.replace(/^@/, '')}`
  : undefined;
---
<ul class="links">
  {links.google_maps && (
    <li><a href={links.google_maps} target="_blank" rel="noopener">Google Maps</a></li>
  )}
  {links.website && (
    <li><a href={links.website} target="_blank" rel="noopener">Site</a></li>
  )}
  {instagramUrl && (
    <li><a href={instagramUrl} target="_blank" rel="noopener">Instagram</a></li>
  )}
</ul>

<style>
  .links {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-5);
    font-size: var(--fs-sm);
  }
</style>
```

- [ ] **Step 2: Create PlaceCard component**

Create `src/components/PlaceCard.astro`:
```astro
---
import type { CollectionEntry } from 'astro:content';
import Links from './Links.astro';
interface Props {
  place: CollectionEntry<'places'>;
  categoryLabel: string;
  categoryColor: string;
}
const { place, categoryLabel, categoryColor } = Astro.props;
const { name, address, hero, links } = place.data;
const slug = place.data.slug;
---
<article class="card">
  <a href={`/place/${slug}`} class="card-link">
    {hero && <img src={hero} alt={name} class="hero" loading="lazy" width="800" height="600" />}
    <div class="body">
      <p class="eyebrow" style={`color: ${categoryColor};`}>{categoryLabel}</p>
      <h2>{name}</h2>
      {address && <p class="muted address">{address}</p>}
    </div>
  </a>
  <Links links={links} />
</article>

<style>
  .card {
    border-bottom: 1px solid var(--color-rule);
    padding: var(--space-6) 0;
  }
  .card:last-child { border-bottom: none; }
  .card-link { color: inherit; border: none; display: block; }
  .hero {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: var(--radius-md);
    filter: saturate(0.95) contrast(1.05);
    margin-bottom: var(--space-4);
  }
  .body h2 {
    font-size: var(--fs-xl);
    margin: var(--space-2) 0;
  }
  .address {
    font-size: var(--fs-sm);
    margin-top: var(--space-1);
  }
</style>
```

- [ ] **Step 3: Update index.astro to list places**

Replace `src/pages/index.astro`:
```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import PlaceCard from '~/components/PlaceCard.astro';
import categoriesData from '~/content/categories.json';

interface Category { slug: string; label: string; color: string; order: number; }
const categories = categoriesData as Category[];
const catBySlug = new Map(categories.map((c) => [c.slug, c]));

const places = await getCollection('places');
places.sort((a, b) => a.data.name.localeCompare(b.data.name, 'fr'));
---
<Base title="Guide de Pérols">
  <header class="hero-header container">
    <p class="eyebrow">Un guide personnel</p>
    <h1>Pérols & autour</h1>
    <p class="muted lead">Nos endroits préférés à 100 km autour de la maison.</p>
  </header>

  <main class="container">
    {places.map((place) => {
      const cat = catBySlug.get(place.data.category);
      return (
        <PlaceCard
          place={place}
          categoryLabel={cat?.label ?? place.data.category}
          categoryColor={cat?.color ?? 'var(--color-ink-soft)'}
        />
      );
    })}
  </main>
</Base>

<style>
  .hero-header {
    padding-top: var(--space-9);
    padding-bottom: var(--space-7);
  }
  .lead { font-size: var(--fs-lg); }
</style>
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`
Open `http://localhost:4321/` (mobile viewport 375×812). Expected:
- Header with eyebrow + Fraunces title.
- The "L'Étang du Méjean" example place renders as a card with the category eyebrow ("Nature & Parcs") in ochre, name in Fraunces, and Google Maps link.
- No hero image (we don't have one yet) — the card still looks intentional.

Stop server.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "Add PlaceCard component and list-view home page"
```

---

## Task 6: Per-place page

**Files:**
- Create: `src/pages/place/[slug].astro`

- [ ] **Step 1: Implement dynamic route**

Create `src/pages/place/[slug].astro`:
```astro
---
import { getCollection, type CollectionEntry } from 'astro:content';
import Base from '~/layouts/Base.astro';
import Links from '~/components/Links.astro';
import categoriesData from '~/content/categories.json';

interface Category { slug: string; label: string; color: string; }
const categories = categoriesData as Category[];

export async function getStaticPaths() {
  const places = await getCollection('places');
  return places.map((place) => ({
    params: { slug: place.data.slug },
    props: { place },
  }));
}

interface Props { place: CollectionEntry<'places'>; }
const { place } = Astro.props;
const { name, address, hero, hero_credit, links, category } = place.data;
const cat = categories.find((c) => c.slug === category);
const { Content } = await place.render();
---
<Base title={`${name} — Guide de Pérols`}>
  <article>
    {hero && (
      <figure class="hero-figure">
        <img src={hero} alt={name} width="1600" height="1200" />
        {hero_credit && <figcaption>{hero_credit}</figcaption>}
      </figure>
    )}
    <header class="container header">
      <p class="eyebrow" style={cat ? `color: ${cat.color};` : ''}>
        {cat?.label ?? category}
      </p>
      <h1>{name}</h1>
      {address && <p class="muted">{address}</p>}
    </header>
    <section class="container prose">
      <Content />
    </section>
    <section class="container">
      <Links links={links} />
    </section>
    <nav class="container back">
      <a href="/">← Retour à la carte</a>
    </nav>
  </article>
</Base>

<style>
  .hero-figure { margin: 0; }
  .hero-figure img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    filter: saturate(0.95) contrast(1.05);
  }
  .hero-figure figcaption {
    text-align: center;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-ink-soft);
    padding: var(--space-2) var(--space-5);
  }
  .header {
    padding-top: var(--space-7);
    padding-bottom: var(--space-4);
  }
  .prose {
    font-family: var(--font-serif);
    font-size: var(--fs-lg);
    line-height: var(--lh-loose);
    padding-bottom: var(--space-7);
  }
  .back {
    padding-bottom: var(--space-9);
    font-size: var(--fs-sm);
  }
</style>
```

- [ ] **Step 2: Visually verify**

Run: `npm run dev`
Open `http://localhost:4321/place/etang-du-mejean`. Expected:
- Header with "Nature & Parcs" eyebrow, large Fraunces name, address.
- Personal comment renders as serif long-form prose (the one from the example).
- "Google Maps" link.
- "← Retour à la carte" back link.

Stop server.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "Add per-place dynamic page"
```

---

## Task 7: Pratique page

**Files:**
- Create: `src/pages/pratique.astro`

- [ ] **Step 1: Implement Pratique page**

Create `src/pages/pratique.astro`:
```astro
---
import Base from '~/layouts/Base.astro';
import { Content } from '~/data/pratique.md';
---
<Base title="Pratique — Guide de Pérols">
  <main class="container">
    <p class="eyebrow"><a href="/">← Retour</a></p>
    <article class="prose">
      <Content />
    </article>
  </main>
</Base>

<style>
  .container { padding-top: var(--space-7); padding-bottom: var(--space-9); }
  .prose :global(h1) { font-size: var(--fs-2xl); }
  .prose :global(h2) {
    font-size: var(--fs-xl);
    margin-top: var(--space-7);
    margin-bottom: var(--space-2);
  }
  .prose :global(ul) {
    padding-left: var(--space-5);
    line-height: var(--lh-loose);
  }
</style>
```

Astro's Markdown integration exports a `Content` component for any `.md` file imported as a module. Since `pratique.md` lives outside `src/content/`, it is treated as a regular markdown asset (not a content collection entry), which is exactly what we want.

- [ ] **Step 2: Visually verify**

Run: `npm run dev`
Open `http://localhost:4321/pratique`. Expected:
- "← Retour" eyebrow link.
- "Pratique" h1.
- "Urgences" section with the four numbers as a bullet list.
- "À remplir." placeholders under other sections.

Stop server.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "Add Pratique page"
```

---

## Task 8: MapLibre component with raster fallback

This task uses public OSM raster tiles as a temporary base map so the map experience can be built and tested before tile assets exist. Task 12 swaps in self-hosted Protomaps tiles.

**Files:**
- Create: `src/components/Map.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Install MapLibre**

Run: `npm install maplibre-gl`

- [ ] **Step 2: Create Map component**

Create `src/components/Map.astro`:
```astro
---
import type { CollectionEntry } from 'astro:content';

interface Category { slug: string; label: string; color: string; }
interface Props {
  places: CollectionEntry<'places'>[];
  categories: Category[];
  center: { lat: number; lon: number };
}
const { places, categories, center } = Astro.props;

const placeData = places.map((p) => ({
  slug: p.data.slug,
  name: p.data.name,
  lat: p.data.lat,
  lon: p.data.lon,
  category: p.data.category,
}));
const catColors = Object.fromEntries(categories.map((c) => [c.slug, c.color]));
---
<div id="map" data-center={`${center.lon},${center.lat}`}></div>

<script is:inline define:vars={{ placeData, catColors }}>
  window.__GUIDE__ = { placeData, catColors };
</script>

<script>
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';

  const el = document.getElementById('map')!;
  const [lon, lat] = el.dataset.center!.split(',').map(Number);
  const { placeData, catColors } = (window as any).__GUIDE__;

  const map = new maplibregl.Map({
    container: 'map',
    center: [lon, lat],
    zoom: 10,
    style: {
      version: 8,
      sources: {
        'osm': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap',
        },
      },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
  });

  map.on('load', () => {
    for (const p of placeData) {
      const color = catColors[p.category] ?? '#1A1814';
      const dot = document.createElement('button');
      dot.className = 'place-dot';
      dot.style.background = color;
      dot.setAttribute('aria-label', p.name);
      dot.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('place:select', { detail: p }));
      });
      new maplibregl.Marker({ element: dot }).setLngLat([p.lon, p.lat]).addTo(map);
    }
  });
</script>

<style>
  #map {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100dvh;
  }
  :global(.place-dot) {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid var(--color-bg, #F4EFE6);
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    cursor: pointer;
    padding: 0;
    transition: transform 0.15s ease;
  }
  :global(.place-dot:active) { transform: scale(1.2); }
</style>
```

- [ ] **Step 3: Replace index with map view**

Replace `src/pages/index.astro`:
```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import Map from '~/components/Map.astro';
import categoriesData from '~/content/categories.json';

interface Category { slug: string; label: string; color: string; order: number; }
const categories = categoriesData as Category[];

const places = await getCollection('places');
const center = { lat: 43.5650, lon: 3.9450 }; // Pérols
---
<Base title="Guide de Pérols">
  <Map places={places} categories={categories} center={center} />
  <header class="topbar">
    <h1>Pérols & autour</h1>
  </header>
</Base>

<style>
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-4) var(--space-5);
    background: linear-gradient(to bottom, rgba(244,239,230,0.95), rgba(244,239,230,0));
    z-index: 10;
    pointer-events: none;
  }
  .topbar h1 {
    font-size: var(--fs-lg);
    margin: 0;
    font-weight: 500;
  }
</style>
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`
Open `http://localhost:4321/` (mobile viewport 375×812). Expected:
- Full-screen map centered on Pérols.
- Top bar with "Pérols & autour" overlay.
- One ochre dot at the example place (Étang du Méjean).
- Tapping the dot does nothing yet — that comes in Task 9.

Stop server.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "Add MapLibre map with place markers (raster fallback)"
```

---

## Task 9: Bottom sheet with place details

**Files:**
- Create: `src/components/PlaceSheet.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Create PlaceSheet component**

Create `src/components/PlaceSheet.astro`:
```astro
---
import type { CollectionEntry } from 'astro:content';
interface Category { slug: string; label: string; color: string; }
interface Props {
  places: CollectionEntry<'places'>[];
  categories: Category[];
}
const { places, categories } = Astro.props;

const detail = places.map((p) => ({
  slug: p.data.slug,
  name: p.data.name,
  category: p.data.category,
  address: p.data.address ?? '',
  hero: p.data.hero ?? '',
  links: p.data.links ?? {},
}));
const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
---
<div id="sheet" class="sheet" aria-hidden="true">
  <button class="sheet-handle" aria-label="Toggle"></button>
  <div class="sheet-body"></div>
</div>

<script is:inline define:vars={{ detail, catBySlug }}>
  window.__GUIDE_SHEET__ = { detail, catBySlug };
</script>

<script>
  const sheet = document.getElementById('sheet')!;
  const body = sheet.querySelector('.sheet-body') as HTMLElement;
  const handle = sheet.querySelector('.sheet-handle') as HTMLElement;
  const { detail, catBySlug } = (window as any).__GUIDE_SHEET__;
  const byslug = Object.fromEntries(detail.map((d: any) => [d.slug, d]));

  function render(slug: string) {
    const p = byslug[slug];
    if (!p) return;
    const cat = catBySlug[p.category];
    const insta = p.links.instagram
      ? `https://instagram.com/${p.links.instagram.replace(/^@/, '')}`
      : '';
    body.innerHTML = `
      ${p.hero ? `<img src="${p.hero}" alt="${p.name}" class="sheet-hero" />` : ''}
      <p class="eyebrow" style="color:${cat?.color ?? 'inherit'}">${cat?.label ?? p.category}</p>
      <h2>${p.name}</h2>
      ${p.address ? `<p class="muted">${p.address}</p>` : ''}
      <ul class="links">
        ${p.links.google_maps ? `<li><a href="${p.links.google_maps}" target="_blank" rel="noopener">Google Maps</a></li>` : ''}
        ${p.links.website ? `<li><a href="${p.links.website}" target="_blank" rel="noopener">Site</a></li>` : ''}
        ${insta ? `<li><a href="${insta}" target="_blank" rel="noopener">Instagram</a></li>` : ''}
      </ul>
      <p class="more"><a href="/place/${p.slug}">Voir la page</a></p>
    `;
    sheet.classList.add('open', 'peek');
    sheet.classList.remove('expanded');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function expand() {
    sheet.classList.add('expanded');
    sheet.classList.remove('peek');
  }
  function collapse() {
    sheet.classList.remove('expanded');
    sheet.classList.add('peek');
  }
  function close() {
    sheet.classList.remove('open', 'peek', 'expanded');
    sheet.setAttribute('aria-hidden', 'true');
  }

  handle.addEventListener('click', () => {
    if (sheet.classList.contains('expanded')) collapse();
    else expand();
  });

  window.addEventListener('place:select', (e: any) => {
    render(e.detail.slug);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
</script>

<style>
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-bg);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.15);
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    z-index: 20;
    max-height: 85dvh;
    overflow: hidden;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .sheet.open.peek { transform: translateY(calc(100% - 160px)); }
  .sheet.open.expanded { transform: translateY(0); }
  .sheet-handle {
    display: block;
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--color-rule);
    border: none;
    margin: var(--space-3) auto;
    cursor: pointer;
  }
  .sheet-body {
    padding: 0 var(--space-5) var(--space-6);
    max-height: calc(85dvh - 32px);
    overflow-y: auto;
  }
  :global(.sheet-hero) {
    width: 100%;
    aspect-ratio: 4/3;
    object-fit: cover;
    border-radius: var(--radius-md);
    filter: saturate(0.95) contrast(1.05);
    margin-bottom: var(--space-4);
  }
  :global(.sheet-body h2) {
    font-family: var(--font-serif);
    font-size: var(--fs-2xl);
    margin: var(--space-2) 0;
  }
  :global(.sheet-body .links) {
    list-style: none;
    padding: 0;
    margin: var(--space-3) 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-5);
    font-size: var(--fs-sm);
  }
  :global(.sheet-body .more) {
    margin-top: var(--space-4);
    font-size: var(--fs-sm);
  }
</style>
```

- [ ] **Step 2: Wire sheet into index**

Modify `src/pages/index.astro` — add the import and the component below the Map:
```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import Map from '~/components/Map.astro';
import PlaceSheet from '~/components/PlaceSheet.astro';
import categoriesData from '~/content/categories.json';

interface Category { slug: string; label: string; color: string; order: number; }
const categories = categoriesData as Category[];

const places = await getCollection('places');
const center = { lat: 43.5650, lon: 3.9450 };
---
<Base title="Guide de Pérols">
  <Map places={places} categories={categories} center={center} />
  <PlaceSheet places={places} categories={categories} />
  <header class="topbar">
    <h1>Pérols & autour</h1>
  </header>
</Base>

<style>
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-4) var(--space-5);
    background: linear-gradient(to bottom, rgba(244,239,230,0.95), rgba(244,239,230,0));
    z-index: 10;
    pointer-events: none;
  }
  .topbar h1 {
    font-size: var(--fs-lg);
    margin: 0;
    font-weight: 500;
  }
</style>
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Open in mobile viewport. Tap the dot. Expected:
- Bottom sheet slides up to "peek" state (~160px visible) showing eyebrow, name, address, links.
- Tap handle → sheet expands to ~85dvh.
- Tap handle again → collapses to peek.
- Press Esc → sheet closes.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "Add bottom sheet with place details"
```

---

## Task 10: Category filter chips

**Files:**
- Create: `src/components/CategoryChips.astro`
- Modify: `src/pages/index.astro`, `src/components/Map.astro`

- [ ] **Step 1: Create CategoryChips component**

Create `src/components/CategoryChips.astro`:
```astro
---
interface Category { slug: string; label: string; color: string; order: number; }
interface Props {
  categories: Category[];
}
const { categories } = Astro.props;
const sorted = [...categories].sort((a, b) => a.order - b.order);
---
<nav class="chips" aria-label="Filtrer par catégorie">
  <button class="chip active" data-category="all">Tout</button>
  {sorted.map((c) => (
    <button class="chip" data-category={c.slug} style={`--chip-color: ${c.color};`}>
      {c.label}
    </button>
  ))}
</nav>

<script>
  const nav = document.querySelector('.chips')!;
  nav.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('chip')) return;
    nav.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    target.classList.add('active');
    const cat = target.dataset.category!;
    window.dispatchEvent(new CustomEvent('category:filter', { detail: { category: cat } }));
  });
</script>

<style>
  .chips {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 56px);
    left: 0;
    right: 0;
    display: flex;
    gap: var(--space-2);
    padding: 0 var(--space-5);
    overflow-x: auto;
    scrollbar-width: none;
    z-index: 11;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chip {
    flex: 0 0 auto;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--color-rule);
    background: rgba(244,239,230,0.92);
    backdrop-filter: blur(8px);
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: var(--fs-sm);
    cursor: pointer;
    white-space: nowrap;
    pointer-events: auto;
  }
  .chip.active {
    background: var(--chip-color, var(--color-ink));
    color: var(--color-bg);
    border-color: transparent;
  }
</style>
```

- [ ] **Step 2: Make Map listen for filter events**

Modify `src/components/Map.astro` — replace the `map.on('load', ...)` block with a version that stores markers by category and listens for filter events:

```ts
  map.on('load', () => {
    const markers: { category: string; marker: maplibregl.Marker }[] = [];
    for (const p of placeData) {
      const color = catColors[p.category] ?? '#1A1814';
      const dot = document.createElement('button');
      dot.className = 'place-dot';
      dot.style.background = color;
      dot.setAttribute('aria-label', p.name);
      dot.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('place:select', { detail: p }));
      });
      const marker = new maplibregl.Marker({ element: dot }).setLngLat([p.lon, p.lat]).addTo(map);
      markers.push({ category: p.category, marker });
    }

    window.addEventListener('category:filter', (e: any) => {
      const cat = e.detail.category;
      for (const m of markers) {
        const visible = cat === 'all' || m.category === cat;
        m.marker.getElement().style.display = visible ? '' : 'none';
      }
    });
  });
```

- [ ] **Step 3: Add CategoryChips to index**

Modify `src/pages/index.astro` — import and render below the topbar:
```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import Map from '~/components/Map.astro';
import PlaceSheet from '~/components/PlaceSheet.astro';
import CategoryChips from '~/components/CategoryChips.astro';
import categoriesData from '~/content/categories.json';

interface Category { slug: string; label: string; color: string; order: number; }
const categories = categoriesData as Category[];

const places = await getCollection('places');
const center = { lat: 43.5650, lon: 3.9450 };
---
<Base title="Guide de Pérols">
  <Map places={places} categories={categories} center={center} />
  <PlaceSheet places={places} categories={categories} />
  <header class="topbar">
    <h1>Pérols & autour</h1>
  </header>
  <CategoryChips categories={categories} />
</Base>

<style>
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-4) var(--space-5);
    background: linear-gradient(to bottom, rgba(244,239,230,0.95), rgba(244,239,230,0));
    z-index: 10;
    pointer-events: none;
  }
  .topbar h1 {
    font-size: var(--fs-lg);
    margin: 0;
    font-weight: 500;
  }
</style>
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`
Mobile viewport. Expected:
- Below the topbar: horizontal pill row "Tout / Restaurants / Cafés & Bars / …"
- "Tout" is active by default (dark fill).
- Tap "Nature & Parcs" — only the Étang du Méjean dot remains visible (the only seed place).
- Tap "Restaurants" — no dots visible.
- Tap "Tout" — Étang reappears.

Stop server.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "Add category filter chips wired to map markers"
```

---

## Task 11: Map ↔ list toggle

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Render a hidden list alongside the map**

Replace `src/pages/index.astro`:
```astro
---
import { getCollection } from 'astro:content';
import Base from '~/layouts/Base.astro';
import Map from '~/components/Map.astro';
import PlaceSheet from '~/components/PlaceSheet.astro';
import CategoryChips from '~/components/CategoryChips.astro';
import PlaceCard from '~/components/PlaceCard.astro';
import categoriesData from '~/content/categories.json';

interface Category { slug: string; label: string; color: string; order: number; }
const categories = categoriesData as Category[];
const catBySlug = new Map(categories.map((c) => [c.slug, c]));

const places = await getCollection('places');
places.sort((a, b) => a.data.name.localeCompare(b.data.name, 'fr'));
const center = { lat: 43.5650, lon: 3.9450 };
---
<Base title="Guide de Pérols">
  <div id="view-map">
    <Map places={places} categories={categories} center={center} />
    <PlaceSheet places={places} categories={categories} />
  </div>

  <div id="view-list" hidden>
    <header class="container list-header">
      <p class="eyebrow">Un guide personnel</p>
      <h1>Pérols & autour</h1>
    </header>
    <main class="container">
      {places.map((place) => {
        const cat = catBySlug.get(place.data.category);
        return (
          <article data-category={place.data.category}>
            <PlaceCard
              place={place}
              categoryLabel={cat?.label ?? place.data.category}
              categoryColor={cat?.color ?? 'var(--color-ink-soft)'}
            />
          </article>
        );
      })}
    </main>
  </div>

  <header class="topbar">
    <h1>Pérols & autour</h1>
  </header>
  <CategoryChips categories={categories} />

  <button id="view-toggle" aria-label="Basculer carte / liste">Liste</button>
</Base>

<script>
  const map = document.getElementById('view-map')!;
  const list = document.getElementById('view-list')!;
  const btn = document.getElementById('view-toggle')!;

  let isList = false;
  btn.addEventListener('click', () => {
    isList = !isList;
    map.hidden = isList;
    list.hidden = !isList;
    btn.textContent = isList ? 'Carte' : 'Liste';
  });

  // Sync category filter to list view as well.
  window.addEventListener('category:filter', (e: any) => {
    const cat = e.detail.category;
    list.querySelectorAll('article[data-category]').forEach((el) => {
      const c = (el as HTMLElement).dataset.category;
      (el as HTMLElement).hidden = !(cat === 'all' || c === cat);
    });
  });
</script>

<style>
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-4) var(--space-5);
    background: linear-gradient(to bottom, rgba(244,239,230,0.95), rgba(244,239,230,0));
    z-index: 10;
    pointer-events: none;
  }
  .topbar h1 {
    font-size: var(--fs-lg);
    margin: 0;
    font-weight: 500;
  }
  .list-header { padding-top: 120px; padding-bottom: var(--space-6); }
  #view-toggle {
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom) + 16px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 15;
    border: none;
    background: var(--color-ink);
    color: var(--color-bg);
    padding: 12px 24px;
    border-radius: 999px;
    font-family: var(--font-sans);
    font-size: var(--fs-sm);
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    cursor: pointer;
  }
</style>
```

- [ ] **Step 2: Verify visually**

Run: `npm run dev`
Mobile viewport. Expected:
- Default: map view, "Liste" button at bottom center.
- Tap "Liste" → list view appears, button now says "Carte".
- Tap a category chip in list mode → list filters.
- Tap "Carte" → map returns.

Stop server.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "Add map/list view toggle"
```

---

## Task 12: Self-hosted Protomaps vector tiles + custom map style

**Files:**
- Create: `scripts/build-tiles.mjs`
- Create: `public/map-style.json`
- Modify: `src/components/Map.astro`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install pmtiles protomaps-themes-base
```

The `pmtiles` CLI for tile manipulation is installed separately on the user's machine (Go binary or via Homebrew). Document this in README later.

- [ ] **Step 2: Write tile build script**

Create `scripts/build-tiles.mjs`:
```js
#!/usr/bin/env node
// Build a Protomaps .pmtiles file for the ~100km region around Pérols.
//
// Prereqs (one-time, user installs):
//   brew install protomaps/tap/go-pmtiles
//   brew install osmium-tool  (optional, for clipping the OSM extract)
//
// Source: Geofabrik Languedoc-Roussillon extract.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TILES_DIR = join(ROOT, 'public', 'tiles');
const TARGET = join(TILES_DIR, 'perols-100km.pmtiles');

// Bounding box ~100km around Pérols (43.565, 3.945).
// 1° lat ≈ 111km. 1° lon at lat 43.5 ≈ 80km.
// So 100km ≈ 0.9° lat and 1.25° lon.
const BBOX = {
  minLon: 2.70,
  minLat: 42.66,
  maxLon: 5.20,
  maxLat: 44.47,
};

function run(cmd) {
  console.log('+', cmd);
  execSync(cmd, { stdio: 'inherit' });
}

function ensureTool(name) {
  try {
    execSync(`which ${name}`, { stdio: 'pipe' });
  } catch {
    console.error(`Required tool not found: ${name}`);
    console.error('Install with: brew install protomaps/tap/go-pmtiles');
    process.exit(1);
  }
}

async function main() {
  ensureTool('pmtiles');
  if (!existsSync(TILES_DIR)) mkdirSync(TILES_DIR, { recursive: true });

  // Protomaps publishes a daily-built world-wide basemap as pmtiles.
  // Easiest path: download a regional extract from the Protomaps S3 bucket
  // and clip it to our bbox using `pmtiles extract`.
  const SOURCE_URL = 'https://build.protomaps.com/20260101.pmtiles'; // example date

  const { minLon, minLat, maxLon, maxLat } = BBOX;
  run(
    `pmtiles extract ${SOURCE_URL} ${TARGET} ` +
    `--bbox=${minLon},${minLat},${maxLon},${maxLat} ` +
    `--maxzoom=14`,
  );

  console.log(`Built ${TARGET}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Note: the exact Protomaps build URL changes daily. The script should attempt the latest known date; the README will instruct the user to update it if needed. The `pmtiles extract` command supports remote sources via HTTP range requests, so we do not need to download the full planet — only the tiles in the bbox are pulled.

- [ ] **Step 3: Create map style**

Create `public/map-style.json`:
```json
{
  "version": 8,
  "name": "Guide Pérols",
  "glyphs": "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
  "sources": {
    "protomaps": {
      "type": "vector",
      "url": "pmtiles:///tiles/perols-100km.pmtiles",
      "attribution": "© Protomaps © OpenStreetMap"
    }
  },
  "layers": []
}
```

The `layers` will be filled at runtime by `protomaps-themes-base`. We can keep this lean and let the JS theme build the layers — see Step 4.

- [ ] **Step 4: Wire pmtiles into Map component**

Modify the `<script>` block in `src/components/Map.astro` to register the pmtiles protocol and use the custom style:

```ts
  import maplibregl from 'maplibre-gl';
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { Protocol } from 'pmtiles';
  import layersFn from 'protomaps-themes-base';

  // Register the pmtiles:// protocol with MapLibre.
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);

  const el = document.getElementById('map')!;
  const [lon, lat] = el.dataset.center!.split(',').map(Number);
  const { placeData, catColors } = (window as any).__GUIDE__;

  const map = new maplibregl.Map({
    container: 'map',
    center: [lon, lat],
    zoom: 10,
    style: {
      version: 8,
      glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
      sources: {
        protomaps: {
          type: 'vector',
          url: 'pmtiles:///tiles/perols-100km.pmtiles',
          attribution: '© Protomaps © OpenStreetMap',
        },
      },
      layers: layersFn('protomaps', 'light'),
    },
  });

  map.on('load', () => {
    // …existing marker code…
  });
```

Keep the existing marker + filter handlers below.

- [ ] **Step 5: Build the tiles**

Run: `npm run build-tiles`
Expected: creates `public/tiles/perols-100km.pmtiles` (likely 30-80 MB). If the Protomaps build URL date is stale, the script prints an error — user updates the date in `scripts/build-tiles.mjs` to the latest available build (listed at `https://maps.protomaps.com/builds.json`).

- [ ] **Step 6: Verify visually**

Run: `npm run dev`
Mobile viewport. Expected:
- Map renders with the Protomaps "light" theme — much sleeker than OSM raster.
- Zooming is smooth (vector tiles).
- Markers still work, sheet still opens, category filter still works.

Stop server.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "Self-host Protomaps tiles and apply light theme"
```

Note: `public/tiles/*.pmtiles` is gitignored. The file is rebuilt on each deploy environment (or uploaded once to Cloudflare Pages as part of deploy). README will document this.

---

## Task 13: Takeout import script (radius filter, URL resolution)

**Files:**
- Create: `scripts/import-takeout.mjs`
- Create: `tests/import-takeout.test.ts`
- Modify: `src/lib/url.ts` (already has resolveShortUrl)

- [ ] **Step 1: Write failing test for Takeout CSV parsing**

Create `tests/import-takeout.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseTakeoutCsv, type TakeoutRow } from '../scripts/import-takeout.mjs';

describe('parseTakeoutCsv', () => {
  it('parses a Saved-list CSV row', () => {
    const csv = `Title,Note,URL\n"Le Petit Bouchon","Bon resto","https://www.google.com/maps/place/Foo/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d43.5709!4d3.9519!16s"\n`;
    const rows = parseTakeoutCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Le Petit Bouchon',
      note: 'Bon resto',
    });
    expect(rows[0].url).toContain('google.com/maps');
  });

  it('handles commas in quoted fields', () => {
    const csv = `Title,Note,URL\n"Foo, Bar","",""\n`;
    const rows = parseTakeoutCsv(csv);
    expect(rows[0].title).toBe('Foo, Bar');
  });

  it('returns empty for empty input', () => {
    expect(parseTakeoutCsv('Title,Note,URL\n')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- import-takeout`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement parser as named export**

Create `scripts/import-takeout.mjs`:
```js
#!/usr/bin/env node
// Parse Google Takeout (Saved + Lists CSVs) into stub Markdown files
// under src/content/places/, filtered to within RADIUS_KM of the author's house.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineKm } from '../src/lib/geo.ts';
import { extractCoordsFromGmapsUrl, resolveShortUrl } from '../src/lib/url.ts';
import { slugify } from '../src/lib/slug.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TAKEOUT_DIR = join(ROOT, 'data', 'takeout');
const PLACES_DIR = join(ROOT, 'src', 'content', 'places');
const REPORT = join(ROOT, 'data', 'import-report.json');

const HOUSE = {
  lat: parseFloat(process.env.HOUSE_LAT ?? '43.5650'),
  lon: parseFloat(process.env.HOUSE_LON ?? '3.9450'),
};
const RADIUS_KM = 100;

export function parseTakeoutCsv(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    title: header.indexOf('title'),
    note: header.indexOf('note'),
    url: header.indexOf('url'),
  };
  if (idx.title === -1 || idx.url === -1) return [];
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseCsvLine(lines[i]);
    out.push({
      title: cells[idx.title] ?? '',
      note: idx.note >= 0 ? (cells[idx.note] ?? '') : '',
      url: cells[idx.url] ?? '',
    });
  }
  return out;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === ',') { out.push(cur); cur = ''; }
      else if (ch === '"') { inQuote = true; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

async function resolveRow(row) {
  let url = row.url;
  if (url.includes('maps.app.goo.gl')) {
    try { url = await resolveShortUrl(url); } catch { /* keep original */ }
  }
  const coords = extractCoordsFromGmapsUrl(url);
  return { ...row, url, coords };
}

function escapeYaml(s) {
  return `"${s.replace(/"/g, '\\"')}"`;
}

function toMarkdown(row) {
  const slug = slugify(row.title);
  const lines = [
    '---',
    `name: ${escapeYaml(row.title)}`,
    `slug: ${slug}`,
    `category: uncategorized`,
    `lat: ${row.coords.lat}`,
    `lon: ${row.coords.lon}`,
    `links:`,
    `  google_maps: ${escapeYaml(row.url)}`,
    `source: "google-takeout"`,
    `google_category: ""`,
    '---',
    row.note ? `<!-- Note Google: ${row.note} -->` : '',
    '',
  ];
  return { slug, content: lines.join('\n') };
}

async function main() {
  if (!existsSync(TAKEOUT_DIR)) {
    console.error(`No data/takeout/ directory. Drop your Google Takeout export there first.`);
    process.exit(1);
  }
  if (!existsSync(PLACES_DIR)) mkdirSync(PLACES_DIR, { recursive: true });

  const files = readdirSync(TAKEOUT_DIR).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (files.length === 0) {
    console.error(`No CSV files in ${TAKEOUT_DIR}.`);
    process.exit(1);
  }

  const all = [];
  for (const f of files) {
    const rows = parseTakeoutCsv(readFileSync(join(TAKEOUT_DIR, f), 'utf8'));
    console.log(`  ${f}: ${rows.length} rows`);
    for (const r of rows) all.push({ ...r, source_file: f });
  }

  const resolved = [];
  for (const row of all) {
    resolved.push(await resolveRow(row));
  }

  const withCoords = resolved.filter((r) => r.coords);
  const inRange = withCoords.filter((r) => haversineKm(HOUSE, r.coords) <= RADIUS_KM);
  const written = [];
  for (const r of inRange) {
    if (!r.title.trim()) continue;
    const { slug, content } = toMarkdown(r);
    const path = join(PLACES_DIR, `${slug}.md`);
    if (existsSync(path)) {
      console.log(`  skip (exists): ${slug}`);
      continue;
    }
    writeFileSync(path, content);
    written.push(slug);
  }

  const report = {
    total_rows: all.length,
    with_coords: withCoords.length,
    in_range: inRange.length,
    written: written.length,
    skipped_no_coords: resolved.length - withCoords.length,
    skipped_out_of_range: withCoords.length - inRange.length,
  };
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('\n--- Import report ---');
  console.log(JSON.stringify(report, null, 2));
}

// Only run if executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

Note: importing `.ts` from `.mjs` works because we run scripts with `tsx`. The tests import directly via Vitest's TS support.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- import-takeout`
Expected: PASS — all 3 cases.

- [ ] **Step 5: Manual smoke test (skip if user hasn't dropped Takeout yet)**

If user has dropped Takeout CSVs into `data/takeout/`, run: `npm run import`
Expected: report logged, stub `.md` files appear in `src/content/places/`. If not, skip — the script is tested by unit tests and will be exercised when user provides data.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "Add Google Takeout import script with radius filter"
```

---

## Task 14: Photo fetch script (Wikimedia first, optional Google Places)

**Files:**
- Create: `scripts/fetch-photos.mjs`

- [ ] **Step 1: Implement Wikimedia search + download**

Create `scripts/fetch-photos.mjs`:
```js
#!/usr/bin/env node
// Fetch one hero photo per place. Tries Wikimedia Commons first
// (free, no API key); optionally falls back to Google Places Photo API.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLACES_DIR = join(ROOT, 'src', 'content', 'places');
const PHOTOS_DIR = join(ROOT, 'public', 'photos');
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const km = line.match(/^([a-z_]+):\s*(.*)$/);
    if (km) fm[km[1]] = km[2].replace(/^"(.*)"$/, '$1');
  }
  return { fm, body: m[2], rawFront: m[1] };
}

function writeFrontmatter(originalText, updates) {
  const parsed = parseFrontmatter(originalText);
  if (!parsed) return originalText;
  const lines = parsed.rawFront.split('\n');
  // Replace or append hero / hero_credit.
  const keys = new Set(Object.keys(updates));
  const newLines = lines.map((l) => {
    const m = l.match(/^([a-z_]+):/);
    if (m && keys.has(m[1])) {
      const k = m[1];
      keys.delete(k);
      return `${k}: "${updates[k].replace(/"/g, '\\"')}"`;
    }
    return l;
  });
  for (const k of keys) {
    newLines.push(`${k}: "${updates[k].replace(/"/g, '\\"')}"`);
  }
  return `---\n${newLines.join('\n')}\n---\n${parsed.body}`;
}

async function searchWikimedia(name) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&` +
    `gsrnamespace=6&gsrlimit=1&gsrsearch=${encodeURIComponent(name)}&prop=imageinfo&iiprop=url|extmetadata`;
  const res = await fetch(url, { headers: { 'User-Agent': 'guide-perols/0.1 (gilles@layer.com)' } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0];
  const info = first?.imageinfo?.[0];
  if (!info?.url) return null;
  const license = info.extmetadata?.LicenseShortName?.value ?? 'Wikimedia';
  const artist = info.extmetadata?.Artist?.value?.replace(/<[^>]*>/g, '') ?? '';
  return { url: info.url, credit: `${artist ? artist + ' / ' : ''}Wikimedia / ${license}` };
}

async function searchGooglePlaces(name, lat, lon) {
  if (!GOOGLE_KEY) return null;
  // Find Place from Text → photo reference
  const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name)}` +
    `&inputtype=textquery&locationbias=point:${lat},${lon}&fields=place_id,photos&key=${GOOGLE_KEY}`;
  const r1 = await fetch(findUrl);
  const d1 = await r1.json();
  const ref = d1?.candidates?.[0]?.photos?.[0]?.photo_reference;
  if (!ref) return null;
  return {
    url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${ref}&key=${GOOGLE_KEY}`,
    credit: 'Google Places',
  };
}

async function downloadTo(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function main() {
  if (!existsSync(PHOTOS_DIR)) mkdirSync(PHOTOS_DIR, { recursive: true });
  const mdFiles = readdirSync(PLACES_DIR).filter((f) => f.endsWith('.md'));
  let fetched = 0, skipped = 0, failed = 0;

  for (const f of mdFiles) {
    const path = join(PLACES_DIR, f);
    const text = readFileSync(path, 'utf8');
    const parsed = parseFrontmatter(text);
    if (!parsed) continue;
    const { fm } = parsed;
    if (fm.hero) { skipped++; continue; }
    const slug = fm.slug ?? f.replace(/\.md$/, '');
    const placeDir = join(PHOTOS_DIR, slug);
    if (!existsSync(placeDir)) mkdirSync(placeDir, { recursive: true });
    const dest = join(placeDir, 'hero.jpg');

    let photo = await searchWikimedia(fm.name);
    if (!photo) photo = await searchGooglePlaces(fm.name, parseFloat(fm.lat), parseFloat(fm.lon));
    if (!photo) { console.log(`  ✗ ${fm.name}`); failed++; continue; }

    try {
      await downloadTo(photo.url, dest);
      const updated = writeFrontmatter(text, {
        hero: `/photos/${slug}/hero.jpg`,
        hero_credit: photo.credit,
      });
      writeFileSync(path, updated);
      console.log(`  ✓ ${fm.name}`);
      fetched++;
    } catch (e) {
      console.log(`  ✗ ${fm.name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nfetched=${fetched} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Manual smoke test**

If at least one place exists in `src/content/places/`, run: `npm run photos`
Expected: hero image downloaded into `public/photos/<slug>/hero.jpg` and `hero`/`hero_credit` written to the .md frontmatter. If Wikimedia has no match and no Google key set, the script logs `✗ <name>` and moves on — that's the documented fallback.

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-photos.mjs
git commit -m "Add photo fetch script (Wikimedia + optional Google Places)"
```

---

## Task 15: robots.txt and privacy meta

**Files:**
- Create: `public/robots.txt`, `public/favicon.svg`
- Modify: `src/layouts/Base.astro` (already has noindex from Task 1)

- [ ] **Step 1: Add robots.txt**

Create `public/robots.txt`:
```
User-agent: *
Disallow: /
```

- [ ] **Step 2: Add a minimalist favicon**

Create `public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="14" fill="#C25B3F"/>
  <circle cx="16" cy="16" r="5" fill="#F4EFE6"/>
</svg>
```

- [ ] **Step 3: Reference favicon in Base layout**

Modify `src/layouts/Base.astro` — add inside `<head>`:
```astro
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "Add robots.txt, favicon, finalize privacy meta"
```

---

## Task 16: Cloudflare Pages deployment

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README with deploy instructions**

Create `README.md`:
```markdown
# Guide de Pérols & autour

Static French guide of favorite places within 100km of Pérols, for friends staying at the house.

## Local development

```bash
npm install
cp .env.example .env  # set HOUSE_LAT / HOUSE_LON
npm run dev
```

## Content pipeline

1. Drop Google Takeout export CSVs into `data/takeout/`.
2. `npm run import` — generates stub `.md` files in `src/content/places/`.
3. (Interactive session with Claude) — categorize, comment, commit.
4. `npm run photos` — fetch hero photos. Wikimedia first; set `GOOGLE_PLACES_API_KEY` for fallback.
5. `npm run build-tiles` — build the local pmtiles file. One-time per machine.

Prereqs for tile build: `brew install protomaps/tap/go-pmtiles`.

## Deploy

Hosted on Cloudflare Pages.

1. Create a new Pages project linked to this GitHub repo (`gi11es/guide-perols-montpellier`).
2. Build command: `npm run build`.
3. Build output directory: `dist`.
4. Environment variables: copy values from `.env`.
5. Tiles (`public/tiles/*.pmtiles`) are gitignored. Upload once via Cloudflare R2 or `wrangler pages deploy --commit-dirty=true` with the tiles present locally before deploy.

The site is unlisted (`robots.txt` + `noindex`). Share the URL only with the intended recipient.
```

- [ ] **Step 2: Create the GitHub repo and push**

Run:
```bash
gh repo create gi11es/guide-perols-montpellier --private --source=. --remote=origin --description "Static French guide of favorite places around Pérols"
git push -u origin main
```

Expected: repo created on `gi11es`, code pushed. URL: `https://github.com/gi11es/guide-perols-montpellier`.

- [ ] **Step 3: Manual: set up Cloudflare Pages**

This step is performed by the user in the Cloudflare dashboard (not scriptable without an account API token in hand). Document was written in the README:
1. Cloudflare → Pages → Create → Connect to Git → select repo.
2. Build command `npm run build`, output `dist`.
3. Deploy.
4. Optional: bind a custom domain.

- [ ] **Step 4: Commit README**

```bash
git add README.md
git commit -m "Add README with development and deployment guide"
git push
```

---

## Self-review notes

This plan covers the spec end-to-end:

- **Stack** → Tasks 1-2 (Astro, lib utilities)
- **Content model** → Task 3 (collections schema)
- **Editorial design** → Tasks 4-5 (tokens, components)
- **Per-place page + Pratique** → Tasks 6-7
- **Map UX (map, sheet, chips, list toggle)** → Tasks 8-11
- **Sleek vector tiles** → Task 12
- **Takeout import + radius filter** → Task 13
- **Photo pipeline** → Task 14
- **Privacy** → Task 15
- **Deploy** → Task 16

**Interactive categorization quiz** (Section: Content pipeline, Phase 2 of the spec) is NOT a plan task — it's a conversational phase done with the user *after* Task 13 runs, using the stub `.md` files produced. The plan terminates at deployable-shell-ready; the quiz happens out-of-band.

The 100km radius filter, French language, unlisted hosting, editorial design, and Cloudflare Pages target are all explicitly implemented or documented.
