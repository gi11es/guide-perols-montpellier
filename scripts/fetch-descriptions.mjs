#!/usr/bin/env node
// Fetch a one-sentence French description for each place via Google Places API (New).
// Uses editorialSummary first, falls back to generativeSummary.overview.
// Skips places that already have a description field.

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
  const keys = new Set(Object.keys(updates));
  const newLines = lines.map((l) => {
    const m = l.match(/^([a-z_]+):/);
    if (m && keys.has(m[1])) {
      const k = m[1];
      keys.delete(k);
      return `${k}: "${updates[k].replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return l;
  });
  for (const k of keys) {
    newLines.push(`${k}: "${updates[k].replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`);
  }
  return `---\n${newLines.join('\n')}\n---\n${parsed.body}`;
}

/** Extract city name from full address string. */
function extractCity(address) {
  if (!address) return '';
  // Address format: "Street, Postcode City, Country" or "City, Dept, Region…"
  // Try to extract a short city name: look for a word before a department/region pattern
  const parts = address.split(',').map((s) => s.trim());
  // Find a part that looks like "12345 City" → take the word after digits
  for (const part of parts) {
    const m = part.match(/^\d{4,6}\s+(.+)$/);
    if (m) return m[1];
  }
  // Fall back to second or first part
  return parts[1] ?? parts[0] ?? '';
}

/** Cut text to a single sentence (first sentence only). */
function toOneSentence(text) {
  // Split on '. ' (period followed by space) keeping only first part
  const idx = text.search(/\.\s+[A-ZÁÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/);
  if (idx !== -1) return text.slice(0, idx + 1).trim();
  return text.trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchDescription(name, city, lat, lon) {
  const query = city ? `${name} ${city}` : name;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.editorialSummary,places.generativeSummary',
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'fr',
      locationBias: {
        circle: { center: { latitude: lat, longitude: lon }, radius: 5000 },
      },
      maxResultCount: 1,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const place = data?.places?.[0];
  if (!place) return null;

  // Prefer editorialSummary, fall back to generativeSummary.overview
  const editorial = place.editorialSummary?.text;
  const generative = place.generativeSummary?.overview?.text;
  const raw = editorial ?? generative ?? null;
  if (!raw) return null;

  return toOneSentence(raw);
}

async function main() {
  const mdFiles = readdirSync(PLACES_DIR).filter((f) => f.endsWith('.md')).sort();
  let fetched = 0, skipped = 0, failed = 0;

  for (const f of mdFiles) {
    const path = join(PLACES_DIR, f);
    const text = readFileSync(path, 'utf8');
    const parsed = parseFrontmatter(text);
    if (!parsed) { console.log(`  ? ${f}: could not parse`); failed++; continue; }
    const { fm } = parsed;

    if (fm.description) {
      skipped++;
      continue;
    }

    const name = fm.name ?? f.replace(/\.md$/, '');
    const lat = parseFloat(fm.lat);
    const lon = parseFloat(fm.lon);
    const city = extractCity(fm.address ?? '');

    try {
      const desc = await fetchDescription(name, city, lat, lon);
      if (!desc) {
        console.log(`  ✗ ${name} (no summary returned)`);
        failed++;
      } else {
        const updated = writeFrontmatter(text, { description: desc });
        writeFileSync(path, updated);
        console.log(`  ✓ ${name}: ${desc.slice(0, 80)}${desc.length > 80 ? '…' : ''}`);
        fetched++;
      }
    } catch (e) {
      console.log(`  ✗ ${name}: ${e.message}`);
      failed++;
    }

    // Throttle: ~3 req/sec
    await sleep(340);
  }

  console.log(`\nfetched=${fetched}  skipped=${skipped}  failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
