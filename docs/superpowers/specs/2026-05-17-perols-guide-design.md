# Pérols Guide — Design Spec

**Date:** 2026-05-17
**Author:** gilles (with Claude Code)
**Status:** Approved, ready for implementation planning

## Purpose

A mobile-web friendly static website, in French, listing the author's favorite places within 100km of his house in Pérols (Hérault, France). Intended for a friend staying at the house without the author present. The friend should be able to browse on a phone, see places on a map, read the author's personal notes, and tap through to Google Maps / Instagram / websites.

## Scope

In:
- A curated guide of places (restaurants, beaches, parks, culture, etc.) within 100km of Pérols.
- An interactive map and a list view of the same data.
- Per-place page with personal comment, hero photo, links.
- A practical/emergency section ("Pratique") with doctor, pharmacy, taxi, etc.
- Deployed to a public-but-unlisted URL.

Out:
- House information (wifi, appliances, quirks) — explicitly excluded.
- Itineraries / day plans.
- Multi-language (French only).
- Any kind of authentication; the site is unlisted (noindex + unguessable URL) not gated.

## Constraints

- Mobile-first. The friend will primarily browse on a phone.
- Static site only. No backend, no DB, no runtime auth.
- Free hosting on Cloudflare Pages.
- All content lives in the repo as Markdown + JSON.
- Radius filter: anything beyond 100km from the author's Pérols house is dropped during import.
- Sleek "editorial / magazine-grade" visual quality is a requirement, not nice-to-have.

## Stack

- **Astro** (static site generator, near-zero JS by default, content collections from Markdown).
- **MapLibre GL JS** (vector tiles, smooth zoom, free).
- **Protomaps** vector tiles for the 100km region, served as a single `.pmtiles` file from the same origin (no API limits, no key).
- **Cloudflare Pages** for hosting (free EU edge, no phone number required, auto-deploy from `main`).
- **GitHub** for the source repo, on the personal account `gi11es`, private.

Rejected alternatives:
- SvelteKit static adapter: overkill, more JS than needed.
- Hand-rolled HTML/CSS/JS: fine for ~30 places but painful for content authoring and per-place routes.
- Mapbox GL JS: paid above free tier; MapLibre is the same engine.
- Leaflet + raster tiles: raster zoom looks less sleek than vector.
- Netlify / Vercel: fine but require phone number; Cloudflare Pages doesn't.

## Repo layout

```
guide-perols-montpellier/
├─ src/
│  ├─ pages/
│  │  ├─ index.astro            # map + list home
│  │  ├─ place/[slug].astro     # per-place page
│  │  ├─ category/[slug].astro  # category landing
│  │  └─ pratique.astro         # emergency / practical info
│  ├─ layouts/
│  │  └─ Base.astro
│  ├─ components/
│  │  ├─ Map.astro              # MapLibre wrapper
│  │  ├─ PlaceSheet.astro       # bottom sheet
│  │  ├─ PlaceCard.astro        # list item
│  │  └─ CategoryChips.astro    # filter chips
│  └─ content/
│     ├─ places/                # one .md per place
│     ├─ categories.json        # category taxonomy
│     └─ pratique.md            # emergency/practical content
├─ public/
│  ├─ photos/<place-slug>/hero.jpg
│  ├─ tiles/perols-100km.pmtiles
│  └─ map-style.json
├─ scripts/
│  ├─ import-takeout.mjs        # Takeout → stub .md files
│  ├─ fetch-photos.mjs          # Wikimedia / Google Places hero photos
│  └─ build-tiles.mjs           # one-time extract of pmtiles for the region
├─ data/
│  └─ takeout/                  # user's Takeout export, gitignored
├─ docs/
│  └─ superpowers/specs/        # this spec lives here
└─ astro.config.mjs
```

## Content model

### Place (`src/content/places/<slug>.md`)

```yaml
---
name: "Le Petit Bouchon"
slug: le-petit-bouchon
category: restaurant        # matches a key in categories.json
lat: 43.5709
lon: 3.9519
address: "12 rue X, Pérols"
phone: "+33 4 ..."
links:
  google_maps: "https://maps.app.goo.gl/..."
  website: "https://..."
  instagram: "@..."
hero: /photos/le-petit-bouchon/hero.jpg
hero_credit: "Wikimedia / CC-BY-SA 4.0"
source: "google-takeout"
google_category: "Restaurant"    # original Google tag, kept for reference
---
Mon commentaire personnel ici. Pourquoi cet endroit est spécial...
```

### Category (`src/content/categories.json`)

```json
[
  {
    "slug": "restaurant",
    "label": "Restaurants",
    "color": "#7A8B3A",
    "icon": "fork-knife",
    "order": 1
  },
  ...
]
```

Final taxonomy is determined during the categorization quiz (Section: Content pipeline) — not pre-baked here.

### Pratique (`src/content/pratique.md`)

A single Markdown file with H2 sections: Urgences, Médecin, Pharmacie, Taxi / VTC, Wi-Fi, etc.

## Map UX

**Home view (`/`)**
- Full-screen MapLibre map fills viewport.
- Thin top bar: site title + horizontal-scroll category chips.
- Single-select category filter (multi-select adds clutter; single is enough).
- Each place is a colored dot (color = category).
- Tapping a dot opens a bottom sheet (peek state): hero photo strip, name, category, distance from user location if permission granted, "Voir plus" expands.
- Sheet expanded state: full hero, French comment, links (Google Maps button, Instagram, website), address. "Voir la page" links to `/place/<slug>` for deep-linking.
- Sticky bottom toggle: "Liste" swaps map for vertical scrollable list of the same filtered data.

**Place page (`/place/<slug>`)**
- Hero photo, name, category badge, French comment as long-form prose.
- Mini-map with just this place + 1km context.
- Links section. "Retour à la carte" link back to home.
- Used for deep-linking ("text your friend `site.com/place/x`").

**Category page (`/category/<slug>`)**
- Header with category label and color.
- Map zoomed to fit all places in the category + a list below.

**Pratique page (`/pratique`)**
- Typographic page, no map.
- Sections: Urgences (15/17/18/112), Médecin, Pharmacie, Taxi/VTC, Wi-Fi, etc.

**Map style**
- Custom MapLibre style: bone/cream background (`#F4EFE6`), sage greens for parks, faded blue for water, terracotta accents for the user's places.
- Aesthetic reference: printed travel maps, not Google Maps.

**Performance**
- Self-hosted Protomaps `.pmtiles` covering only the ~100km region — small file, no API quotas.
- Astro ships near-zero JS for non-map pages.
- Map JS loads only on pages that need it.

## Editorial design direction

**Type**
- Display serif: **Fraunces** (variable, free via Google Fonts). For place names, category titles, hero text.
- Body sans: **Inter** (free). For UI, addresses, metadata.
- Long-form prose (personal comments): Fraunces at body size — same voice as display.

**Color palette**
- Background: bone `#F4EFE6`.
- Ink: deep `#1A1814`.
- Accent: terracotta `#C25B3F`.
- Category dots: olive (food), sea-blue (beach/water), dusty rose (culture/art), ochre (nature/parks), graphite (practical/shopping). Final palette per category locks in once taxonomy is approved.

**Motion**
- Bottom sheet drags with iOS-style rubberbanding.
- Map dots scale slightly on tap.
- Page transitions: cross-fade only. No slide-ins.

**Imagery**
- Hero photos cropped 4:3.
- Subtle CSS warm grade (`saturate(0.95) contrast(1.05)`) for cohesion across sources.
- Photo credits in small caps below hero.

**Layout**
- Mobile-first single column.
- 16-20px gutters.
- Strong typographic hierarchy: big names, small/quiet metadata, breathing comments.

## Content pipeline

### Phase 1 — Import

`npm run import`:
1. Read all CSV/JSON/KML files from `data/takeout/`.
2. For each place: extract name, note, Google Maps URL; resolve URL to lat/lon (follow `maps.app.goo.gl` redirects, parse coords from resolved URL).
3. Pull whatever metadata is in the Takeout entry (Google category, address, phone, website if present).
4. Filter to ≤100km from the author's Pérols house coordinates (provided once by user).
5. Write a stub `.md` per place into `src/content/places/`. Body is empty (no comment yet).
6. Write a `import-report.json` summarizing: total places parsed, filtered out, by Google category — used to seed the taxonomy proposal.

### Phase 2 — Categorization quiz (interactive, in-conversation)

1. Claude proposes 6-10 categories based on the `import-report.json` Google tags, with evidence ("14 'Restaurant', 6 'Park'…").
2. User approves/edits the taxonomy. Saved to `src/content/categories.json`.
3. Walk category-by-category. For each place in the category:
   - Show name + Google's note + URL.
   - User says keep / cut / merge into another category.
   - For kept places, user dictates a one-or-two-sentence French comment.
   - Claude updates the `.md` file inline.
4. Progress is committed periodically to git so no work is lost.

### Phase 3 — Photos

`npm run photos`:
1. For each kept place, query Wikimedia Commons by place name + city.
2. If no match, fall back to Google Places Photo API (only if the user provides a key — otherwise leave hero blank and the place renders with a typographic fallback).
3. Download to `public/photos/<slug>/hero.jpg`, write `hero` and `hero_credit` into the `.md`.

### Phase 4 — Tiles

`npm run build-tiles` (one-time):
1. Extract a `.pmtiles` file from the OpenStreetMap planet (or a regional excerpt) clipped to ~100km around Pérols.
2. Output to `public/tiles/perols-100km.pmtiles`.

### Phase 5 — Build & deploy

- `npm run dev` — Astro dev server with hot reload.
- `npm run build` — static build to `dist/`.
- Push to `main` on `gi11es/guide-perols-montpellier` → Cloudflare Pages auto-deploys.

## Privacy

- Repo is private.
- Site has `<meta name="robots" content="noindex,nofollow">` and a `robots.txt` disallow-all.
- URL is unguessable; we share it only with the friend.
- No analytics by default (can revisit if the user wants to see if the friend used the site).

## Open items at spec time

- **Author's house coordinates**: needed for radius filter. User to provide before Phase 1.
- **Final category taxonomy**: determined interactively in Phase 2.
- **Google Places API key**: optional; only needed if Wikimedia coverage is thin for non-touristy places.

## Success criteria

- Friend can open the site on a phone, see a sleek map of curated places, tap any place, read the author's note in French, and tap through to Google Maps / Instagram / website.
- Loads fast on mobile data in France.
- Looks like a deliberately designed editorial guide, not a template.
- Author's curation workload is bounded: keep/cut decisions + one comment per kept place; everything else automated.
