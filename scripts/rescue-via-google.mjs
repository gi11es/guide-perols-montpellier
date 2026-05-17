#!/usr/bin/env node
// Rescue: resolve the remaining nominatim_misses by extracting Google's
// FID from the original URL, looking it up via Places API (Text Search),
// and writing the .md files.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { haversineKm } from '../src/lib/geo.ts';
import { slugify } from '../src/lib/slug.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT = join(ROOT, 'data', 'import-report.json');
const TAKEOUT = join(ROOT, 'data', 'takeout', 'Favorite_places.csv');
const PLACES_DIR = join(ROOT, 'src', 'content', 'places');
const RESCUE_REPORT = join(ROOT, 'data', 'rescue-google-report.json');

const HOUSE = {
  lat: parseFloat(process.env.HOUSE_LAT ?? '43.5546662'),
  lon: parseFloat(process.env.HOUSE_LON ?? '3.9642029'),
};
const RADIUS_KM = 100;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_KEY) {
  console.error('GOOGLE_PLACES_API_KEY is not set. Add it to .env first.');
  process.exit(1);
}

function escapeYaml(s) {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
}

function parseCsvStream(text) {
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], cur = '', inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(cur); cur = ''; }
      else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (ch === '\r') {}
      else { cur += ch; }
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

// Try Place Text Search: searches by name, returns place_id + coords.
// Uses the "New" Places API; bias to France for better results.
async function searchPlaceByText(name) {
  const url = 'https://places.googleapis.com/v1/places:searchText';
  const body = {
    textQuery: name,
    locationBias: {
      circle: {
        center: { latitude: HOUSE.lat, longitude: HOUSE.lon },
        radius: 50_000.0,
      },
    },
    maxResultCount: 1,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress,places.websiteUri',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`  HTTP ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const place = data?.places?.[0];
    if (!place) return null;
    return {
      placeId: place.id,
      name: place.displayName?.text ?? name,
      lat: place.location.latitude,
      lon: place.location.longitude,
      address: place.formattedAddress ?? '',
      website: place.websiteUri ?? '',
    };
  } catch (e) {
    console.error(`  fetch error: ${e.message}`);
    return null;
  }
}

async function main() {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'));
  const misses = report.nominatim_misses ?? [];
  console.log(`Looking up ${misses.length} misses via Google Places Text Search...`);

  const csv = readFileSync(TAKEOUT, 'utf8');
  const rows = parseCsvStream(csv);
  const header = rows[0].map((h) => h.toLowerCase());
  const idx = {
    title: header.indexOf('title'),
    note: header.indexOf('note'),
    url: header.indexOf('url'),
    tags: header.indexOf('tags'),
    comment: header.indexOf('comment'),
  };
  const byTitle = new Map();
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    const title = cells[idx.title] ?? '';
    if (title) byTitle.set(title, {
      title,
      note: cells[idx.note] ?? '',
      url: cells[idx.url] ?? '',
      tags: cells[idx.tags] ?? '',
      comment: cells[idx.comment] ?? '',
    });
  }

  const recovered = [];
  const stillMissing = [];
  const outOfRange = [];

  for (const title of misses) {
    const row = byTitle.get(title);
    if (!row) { stillMissing.push(title); continue; }
    const result = await searchPlaceByText(title);
    if (!result) { stillMissing.push(title); console.log(`  ✗ ${title}`); continue; }
    const dist = haversineKm(HOUSE, { lat: result.lat, lon: result.lon });
    if (dist > RADIUS_KM) {
      outOfRange.push({ title, dist: dist.toFixed(1), address: result.address });
      console.log(`  ⊘ ${title} → ${result.address} (${dist.toFixed(1)}km)`);
      continue;
    }
    recovered.push({ row, ...result });
    console.log(`  ✓ ${title} → ${result.address}`);
  }

  if (!existsSync(PLACES_DIR)) mkdirSync(PLACES_DIR, { recursive: true });
  let written = 0;
  for (const r of recovered) {
    const slug = slugify(r.row.title);
    const path = join(PLACES_DIR, `${slug}.md`);
    if (existsSync(path)) { console.log(`  skip (exists): ${slug}`); continue; }
    const lines = [
      '---',
      `name: ${escapeYaml(r.row.title)}`,
      `slug: ${slug}`,
      `category: uncategorized`,
      `lat: ${r.lat}`,
      `lon: ${r.lon}`,
    ];
    if (r.address) lines.push(`address: ${escapeYaml(r.address)}`);
    lines.push('links:');
    if (r.row.url) lines.push(`  google_maps: ${escapeYaml(r.row.url)}`);
    if (r.website) lines.push(`  website: ${escapeYaml(r.website)}`);
    lines.push(`source: "google-takeout"`);
    lines.push(`google_category: ""`);
    if (r.row.tags?.trim()) lines.push(`tags: ${escapeYaml(r.row.tags)}`);
    if (r.row.comment?.trim()) lines.push(`comment: ${escapeYaml(r.row.comment)}`);
    lines.push('---', r.row.note ? `<!-- Note Google: ${r.row.note} -->` : '', '');
    writeFileSync(path, lines.join('\n'));
    written++;
  }

  const rescueReport = {
    attempted: misses.length,
    recovered_in_range: recovered.length,
    written,
    recovered_out_of_range: outOfRange.length,
    still_missing: stillMissing.length,
    still_missing_titles: stillMissing,
    out_of_range: outOfRange,
  };
  writeFileSync(RESCUE_REPORT, JSON.stringify(rescueReport, null, 2));
  console.log('\n--- Rescue (Google) report ---');
  console.log(JSON.stringify(rescueReport, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
