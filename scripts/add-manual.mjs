#!/usr/bin/env node
// One-shot: add manually-named places (geocoded via Nominatim) under a given category.

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/lib/slug.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLACES_DIR = join(ROOT, 'src', 'content', 'places');

const ENTRIES = [
  { name: 'Scholler', category: 'boulangerie', query: 'Scholler boulangerie, Lattes, France' },
  { name: 'Des Pains et des Rêves', category: 'boulangerie', query: 'Des Pains et des Rêves, Montpellier, France' },
];

function escapeYaml(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
}

let lastNominatim = 0;
async function geocodeNominatim(query) {
  const since = Date.now() - lastNominatim;
  if (since < 1100) await new Promise((r) => setTimeout(r, 1100 - since));
  lastNominatim = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'guide-perols/0.1 (gilles@layer.com)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
}

async function geocodeGoogle(query) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress',
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        circle: { center: { latitude: 43.5546662, longitude: 3.9642029 }, radius: 50_000 },
      },
      maxResultCount: 1,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const p = data?.places?.[0];
  if (!p) return null;
  return { lat: p.location.latitude, lon: p.location.longitude, display: p.formattedAddress ?? '' };
}

async function geocode(query) {
  return (await geocodeNominatim(query)) ?? (await geocodeGoogle(query));
}

async function main() {
  if (!existsSync(PLACES_DIR)) mkdirSync(PLACES_DIR, { recursive: true });
  for (const e of ENTRIES) {
    const result = await geocode(e.query);
    if (!result) { console.log(`  ✗ ${e.name}`); continue; }
    const slug = slugify(e.name);
    const path = join(PLACES_DIR, `${slug}.md`);
    if (existsSync(path)) { console.log(`  skip (exists): ${slug}`); continue; }
    const lines = [
      '---',
      `name: ${escapeYaml(e.name)}`,
      `slug: ${slug}`,
      `category: ${e.category}`,
      `lat: ${result.lat}`,
      `lon: ${result.lon}`,
      `address: ${escapeYaml(result.display)}`,
      `links: {}`,
      `source: "manual"`,
      `google_category: ""`,
      '---',
      '',
    ];
    writeFileSync(path, lines.join('\n'));
    console.log(`  ✓ ${e.name} → ${result.display}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
