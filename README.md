# Guide de Pérols & autour

Static French guide of favorite places within 100km of Pérols, for friends staying at the house.

## Local development

```bash
npm install
cp .env.example .env  # set HOUSE_LAT / HOUSE_LON
npm run dev
```

Open http://localhost:4321/.

## Content pipeline

1. Drop Google Takeout export CSVs into `data/takeout/`.
2. `npm run import` — generates stub `.md` files in `src/content/places/`, filtered to within 100km of `HOUSE_LAT`/`HOUSE_LON`.
3. (Interactive session) — review categories, comment, commit. The author dictates a one-or-two-sentence French note per place.
4. `npm run photos` — fetch hero photos. Wikimedia Commons first; set `GOOGLE_PLACES_API_KEY` in `.env` for fallback.

## Map tiles

The map uses a remote Protomaps sample basemap by default — no setup required.

For a region-specific, self-hosted pmtiles file:

```bash
brew install protomaps/tap/go-pmtiles   # one-time, if available
npm run build-tiles                      # downloads + extracts a ~100km bbox
```

Then update `PMTILES_URL` in `src/components/Map.astro` to `/tiles/perols-100km.pmtiles`. The output file is gitignored — upload it to your host alongside the build.

## Tests

```bash
npm test          # one-shot
npm run test:watch
```

## Deploy

Hosted on Cloudflare Pages.

1. Create a new Pages project linked to this GitHub repo (`gi11es/guide-perols-montpellier`).
2. Build command: `npm run build`.
3. Build output directory: `dist`.
4. Environment variables (in Cloudflare dashboard): copy values from `.env` — `HOUSE_LAT`, `HOUSE_LON`, optionally `GOOGLE_PLACES_API_KEY`.
5. If using self-hosted pmtiles, upload `public/tiles/perols-100km.pmtiles` once (e.g. via `wrangler pages deploy` with the file present, or via Cloudflare R2 + URL update).

The site is unlisted (`robots.txt` + `<meta name="robots" content="noindex,nofollow">`). Share the URL only with the intended recipient.
