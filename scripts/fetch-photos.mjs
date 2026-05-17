#!/usr/bin/env node
// Fetch one hero photo per place. Tries Wikimedia Commons first
// (free, no API key); optionally falls back to Google Places Photo API.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

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
  const res = await fetch(url, {
    headers: { 'User-Agent': 'guide-perols/0.1 (gilles@layer.com)' },
    signal: AbortSignal.timeout(10_000),
  });
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
  // Places API (New): Text Search → photo names → media URL
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.photos,places.authorAttributions',
    },
    body: JSON.stringify({
      textQuery: name,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lon }, radius: 5000 },
      },
      maxResultCount: 1,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const photo = data?.places?.[0]?.photos?.[0];
  if (!photo?.name) return null;
  // Photo media URL — appending key in querystring works for direct fetch.
  const author = photo.authorAttributions?.[0]?.displayName ?? '';
  return {
    url: `https://places.googleapis.com/v1/${photo.name}/media?maxHeightPx=1200&maxWidthPx=1600&key=${GOOGLE_KEY}`,
    credit: `${author ? author + ' / ' : ''}Google Places`,
  };
}

async function downloadTo(url, dest) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'guide-perols/0.1 (gilles@layer.com)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  if (!res.body) throw new Error('No response body');
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Categories where Wikimedia has legitimate landmark photos.
// For business categories, Wikimedia almost always returns mismatched photos
// (matching the name to an unrelated image), so we skip it.
const WIKIMEDIA_CATEGORIES = new Set(['nature', 'villes-villages', 'culture']);

async function main() {
  if (!existsSync(PLACES_DIR)) {
    console.error(`No places yet at ${PLACES_DIR}. Run import-takeout first.`);
    process.exit(1);
  }
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

    const useWikimedia = WIKIMEDIA_CATEGORIES.has(fm.category);
    let photo = null;
    if (useWikimedia) {
      photo = await searchWikimedia(fm.name);
    }
    if (!photo) {
      photo = await searchGooglePlaces(fm.name, parseFloat(fm.lat), parseFloat(fm.lon));
    }
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
    // Rate-limit ourselves: be a polite Wikimedia/Google client.
    await sleep(500);
  }

  console.log(`\nfetched=${fetched} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
