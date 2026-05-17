#!/usr/bin/env node
/**
 * fix-maps-links.mjs
 *
 * Backfill direct Google Maps Place-ID links for every place in the guide.
 * For each src/content/places/*.md, calls Google Places (New) searchText API,
 * retrieves the Place ID, and writes a canonical direct URL:
 *   https://www.google.com/maps/place/?q=place_id:<PLACE_ID>
 *
 * Usage:
 *   set -a && source .env && set +a && tsx scripts/fix-maps-links.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLACES_DIR = join(ROOT, 'src', 'content', 'places');
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_KEY) {
  console.error('GOOGLE_PLACES_API_KEY is not set. Source .env first.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Frontmatter YAML parser — handles the `links:` block specially
// ---------------------------------------------------------------------------

/**
 * Parse only the top-level keys we care about from the raw frontmatter string.
 * Returns { name, lat, lon, rawFront, body }.
 */
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const rawFront = m[1];
  const body = m[2];

  const fm = {};
  for (const line of rawFront.split('\n')) {
    const km = line.match(/^([a-zA-Z_]+):\s*"?([^"]*)"?\s*$/);
    if (km) fm[km[1]] = km[2];
  }
  return { fm, rawFront, body };
}

/**
 * Rewrite the `links:` block in the raw frontmatter to include/replace `google_maps`.
 *
 * Handles:
 *   links: {}                     → links:\n  google_maps: "..."
 *   links:\n  google_maps: "..."  → replace URL
 *   links:\n  website: "..."      → add google_maps line before other sub-keys
 *   links:                        → add google_maps sub-key (rare: bare key no value)
 */
function updateLinksBlock(rawFront, googleMapsUrl) {
  const lines = rawFront.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect `links: {}` (inline empty object)
    if (/^links:\s*\{\}\s*$/.test(line)) {
      result.push('links:');
      result.push(`  google_maps: "${googleMapsUrl}"`);
      i++;
      continue;
    }

    // Detect `links:` block start (with optional trailing space/comment)
    if (/^links:\s*$/.test(line)) {
      result.push(line);
      i++;

      // Collect the sub-keys (lines that start with two spaces)
      let hasGoogleMaps = false;
      const subLines = [];
      while (i < lines.length && /^  /.test(lines[i])) {
        subLines.push(lines[i]);
        if (/^  google_maps:/.test(lines[i])) hasGoogleMaps = true;
        i++;
      }

      if (hasGoogleMaps) {
        // Replace the google_maps sub-key value
        for (const sl of subLines) {
          if (/^  google_maps:/.test(sl)) {
            result.push(`  google_maps: "${googleMapsUrl}"`);
          } else {
            result.push(sl);
          }
        }
      } else {
        // Prepend google_maps before existing sub-keys
        result.push(`  google_maps: "${googleMapsUrl}"`);
        for (const sl of subLines) {
          result.push(sl);
        }
      }
      continue;
    }

    result.push(line);
    i++;
  }

  return result.join('\n');
}

// ---------------------------------------------------------------------------
// Google Places API
// ---------------------------------------------------------------------------

async function fetchPlaceId(name, lat, lon) {
  const body = {
    textQuery: name,
    maxResultCount: 1,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lon },
        radius: 5000,
      },
    },
  };

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const placeId = data?.places?.[0]?.id;
  return placeId ?? null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const files = readdirSync(PLACES_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

let updated = 0;
let skipped = 0;
let failed = 0;
const samples = [];

console.log(`Processing ${files.length} places…\n`);

for (let idx = 0; idx < files.length; idx++) {
  const file = files[idx];
  const filePath = join(PLACES_DIR, file);
  const text = readFileSync(filePath, 'utf8');

  const parsed = parseFrontmatter(text);
  if (!parsed) {
    console.error(`✗ ${file} — could not parse frontmatter`);
    failed++;
    continue;
  }

  const { fm, rawFront, body } = parsed;
  const name = fm.name;
  const lat = parseFloat(fm.lat);
  const lon = parseFloat(fm.lon);

  if (!name || isNaN(lat) || isNaN(lon)) {
    console.error(`✗ ${file} — missing name/lat/lon`);
    failed++;
    continue;
  }

  const label = `[${idx + 1}/${files.length}] ${name}`;

  try {
    const placeId = await fetchPlaceId(name, lat, lon);

    if (!placeId) {
      console.log(`  ${label} — no Place ID found`);
      skipped++;
    } else {
      const url = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
      const newRawFront = updateLinksBlock(rawFront, url);
      const newText = `---\n${newRawFront}\n---\n${body}`;
      writeFileSync(filePath, newText, 'utf8');
      console.log(`✓ ${label}`);
      updated++;
      if (samples.length < 3) {
        samples.push({ name, file, url });
      }
    }
  } catch (err) {
    console.error(`✗ ${label} — ${err.message}`);
    failed++;
  }

  // Throttle: ~3 req/sec (300ms gap)
  if (idx < files.length - 1) {
    await sleep(300);
  }
}

console.log('\n─────────────────────────────────────');
console.log(`Done.`);
console.log(`  Updated : ${updated}`);
console.log(`  Skipped : ${skipped}  (no Place ID returned)`);
console.log(`  Failed  : ${failed}  (API error or parse error)`);
console.log(`  Total   : ${files.length}`);

if (samples.length > 0) {
  console.log('\nSample updated places:');
  for (const s of samples) {
    console.log(`  ${s.name} (${s.file})`);
    console.log(`    → ${s.url}`);
  }
}
