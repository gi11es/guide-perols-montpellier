#!/usr/bin/env node
// Parse Google Takeout (Saved + Lists CSVs) into stub Markdown files
// under src/content/places/, filtered to within RADIUS_KM of the author's house.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
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
  text = text.replace(/^﻿/, '');
  const rows = parseCsvStream(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    title: header.indexOf('title'),
    note: header.indexOf('note'),
    url: header.indexOf('url'),
    tags: header.indexOf('tags'),
    comment: header.indexOf('comment'),
  };
  if (idx.title === -1 || idx.url === -1) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.every((c) => !c || !c.trim())) continue;  // skip blank rows
    out.push({
      title: cells[idx.title] ?? '',
      note: idx.note >= 0 ? (cells[idx.note] ?? '') : '',
      url: cells[idx.url] ?? '',
      tags: idx.tags >= 0 ? (cells[idx.tags] ?? '') : '',
      comment: idx.comment >= 0 ? (cells[idx.comment] ?? '') : '',
    });
  }
  return out;
}

function parseCsvStream(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQuote = false;
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
      else if (ch === '\r') { /* skip; \n handles row break */ }
      else { cur += ch; }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

let lastNominatim = 0;
async function geocodeByName(name) {
  if (!name?.trim()) return null;
  // Throttle to 1 req/sec.
  const since = Date.now() - lastNominatim;
  if (since < 1100) await new Promise((r) => setTimeout(r, 1100 - since));
  lastNominatim = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'guide-perols/0.1 (gilles@layer.com)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

async function resolveRow(row) {
  let url = row.url;
  if (url.includes('maps.app.goo.gl') || /^https:\/\/goo\.gl\/maps/.test(url)) {
    try { url = await resolveShortUrl(url); } catch { /* keep original */ }
  }
  let coords = extractCoordsFromGmapsUrl(url);
  let resolvedByNominatim = false;
  if (!coords) {
    coords = await geocodeByName(row.title);
    if (coords) resolvedByNominatim = true;
  }
  return { ...row, url, coords, resolvedByNominatim };
}

export function escapeYaml(s) {
  return `"${s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')}"`;
}

export function toMarkdown(row) {
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
  ];
  if (row.tags) lines.push(`tags: ${escapeYaml(row.tags)}`);
  if (row.comment) lines.push(`comment: ${escapeYaml(row.comment)}`);
  lines.push('---');
  lines.push(row.note ? `<!-- Note Google: ${row.note} -->` : '');
  lines.push('');
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
  let resolvedByNominatimCount = 0;
  const nominatimMisses = [];
  for (const r of resolved) {
    if (r.resolvedByNominatim) resolvedByNominatimCount++;
    if (!r.coords && r.title.trim()) nominatimMisses.push(r.title);
  }
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
    resolved_by_nominatim: resolvedByNominatimCount,
    nominatim_misses: nominatimMisses,
  };
  writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('\n--- Import report ---');
  console.log(JSON.stringify(report, null, 2));
}

// Only run if executed directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
