#!/usr/bin/env node
// Refetch hero photos for every place that has a Google place_id,
// using the Places API (New) /places/<PLACE_ID> endpoint.
// This guarantees we get the photo for the EXACT place, not a namesake.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLACES_DIR = join(ROOT, 'src', 'content', 'places');
const PHOTOS_DIR = join(ROOT, 'public', 'photos');
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_KEY) {
  console.error('GOOGLE_PLACES_API_KEY is not set');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    // Top-level keys (no leading spaces)
    const km = line.match(/^([a-z_]+):\s*(.*)$/);
    if (km) { fm[km[1]] = km[2].replace(/^"(.*)"$/, '$1'); continue; }
    // Nested keys (indented with spaces) — store with flat key name
    const nested = line.match(/^\s+([a-z_]+):\s*(.*)$/);
    if (nested) fm[nested[1]] = nested[2].replace(/^"(.*)"$/, '$1');
  }
  return { fm, body: m[2], rawFront: m[1] };
}

/** Escape a string value for YAML double-quoted scalar. */
function escapeYaml(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function writeFrontmatter(originalText, updates) {
  const parsed = parseFrontmatter(originalText);
  if (!parsed) return originalText;
  const lines = parsed.rawFront.split('\n');
  const keys = new Set(Object.keys(updates));
  const newLines = [];
  let skipContinuation = false; // true when we just replaced a potentially multi-line value
  for (const l of lines) {
    const m = l.match(/^([a-z_]+):/);
    if (m) {
      // A new top-level key always ends any continuation
      skipContinuation = false;
      if (keys.has(m[1])) {
        const k = m[1];
        keys.delete(k);
        newLines.push(`${k}: "${escapeYaml(updates[k])}"`);
        // If old value wasn't a properly closed quoted string on one line,
        // mark that subsequent lines until the next top-level key should be dropped.
        const rest = l.slice(l.indexOf(':') + 1).trim();
        const isClosed = rest.startsWith('"') && rest.endsWith('"') && rest.length > 1;
        if (!isClosed) skipContinuation = true;
        continue;
      }
    } else if (skipContinuation) {
      // This line is a continuation of the multi-line value we just replaced — drop it.
      continue;
    }
    newLines.push(l);
  }
  for (const k of keys) {
    newLines.push(`${k}: "${escapeYaml(updates[k])}"`);
  }
  return `---\n${newLines.join('\n')}\n---\n${parsed.body}`;
}

// ---------------------------------------------------------------------------
// Magic-byte image verification
// ---------------------------------------------------------------------------

function isRealImage(buf) {
  if (buf.length < 4) return false;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPlaceDetails(placeId) {
  const url = `https://places.googleapis.com/v1/places/${placeId}?fields=id,displayName,photos`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Places Details ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Download a photo and return its raw bytes as a Buffer. */
async function fetchPhotoBytes(photoName) {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=1200&maxWidthPx=1600&key=${GOOGLE_KEY}`;
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Photo download ${res.status}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(PLACES_DIR)) {
    console.error(`No places directory at ${PLACES_DIR}`);
    process.exit(1);
  }
  if (!existsSync(PHOTOS_DIR)) mkdirSync(PHOTOS_DIR, { recursive: true });

  const mdFiles = readdirSync(PLACES_DIR).filter((f) => f.endsWith('.md'));

  let refetched = 0;
  let skipped_no_place_id = 0;
  let failed = 0;
  const failedSlugs = [];

  for (const f of mdFiles) {
    const filePath = join(PLACES_DIR, f);
    const text = readFileSync(filePath, 'utf8');
    const parsed = parseFrontmatter(text);
    if (!parsed) {
      console.log(`  ? ${f}: could not parse frontmatter`);
      continue;
    }

    const { fm } = parsed;
    const slug = fm.slug ?? f.replace(/\.md$/, '');

    // Extract place_id from the google_maps link
    const googleMapsUrl = fm.google_maps ?? '';
    const placeIdMatch = googleMapsUrl.match(/place_id:([A-Za-z0-9_-]+)/);

    if (!placeIdMatch) {
      console.log(`  — ${slug}: no place_id — skipping`);
      skipped_no_place_id++;
      continue;
    }

    const placeId = placeIdMatch[1];

    // Ensure output directory exists
    const placeDir = join(PHOTOS_DIR, slug);
    if (!existsSync(placeDir)) mkdirSync(placeDir, { recursive: true });
    const dest = join(placeDir, 'hero.jpg');

    // Fetch place details
    let details;
    try {
      details = await fetchPlaceDetails(placeId);
    } catch (e) {
      console.log(`  ✗ ${slug}: Places Details error — ${e.message}`);
      failed++;
      failedSlugs.push(slug);
      await sleep(300);
      continue;
    }

    const photos = details.photos ?? [];
    if (photos.length === 0) {
      console.log(`  ✗ ${slug}: no photos in Places Details response`);
      failed++;
      failedSlugs.push(slug);
      await sleep(300);
      continue;
    }

    // Pick landscape photo if available, else first
    const landscape = photos.find((p) => (p.widthPx ?? 0) >= (p.heightPx ?? 0));
    const chosen = landscape ?? photos[0];

    // Try photos in order until we get a valid image
    const candidates = landscape
      ? [landscape, ...photos.filter((p) => p !== landscape)]
      : photos;

    let photoBuffer = null;
    let usedPhoto = null;
    for (const candidate of candidates) {
      let buf;
      try {
        buf = await fetchPhotoBytes(candidate.name);
      } catch (e) {
        console.log(`    ~ ${slug}: photo download error — ${e.message}, trying next`);
        await sleep(300);
        continue;
      }

      if (!isRealImage(buf)) {
        console.log(`    ~ ${slug}: non-image bytes returned (${buf.slice(0, 4).toString('hex')}), trying next`);
        await sleep(300);
        continue;
      }

      photoBuffer = buf;
      usedPhoto = candidate;
      break;
    }

    if (!photoBuffer || !usedPhoto) {
      console.log(`  ✗ ${slug}: all ${candidates.length} photo(s) were non-image or failed`);
      failed++;
      failedSlugs.push(slug);
      await sleep(300);
      continue;
    }

    // Write the file
    writeFileSync(dest, photoBuffer);

    // Build credit
    const authorName = usedPhoto.authorAttributions?.[0]?.displayName ?? '';
    const credit = authorName ? `${authorName} / Google Places` : 'Google Places';

    // Update frontmatter
    const updated = writeFrontmatter(text, {
      hero: `/photos/${slug}/hero.jpg`,
      hero_credit: credit,
    });
    writeFileSync(filePath, updated);

    console.log(`  ✓ ${slug} (${details.displayName?.text ?? placeId})`);
    refetched++;

    await sleep(300);
  }

  console.log('\n--- Summary ---');
  console.log(`refetched:            ${refetched}`);
  console.log(`skipped_no_place_id:  ${skipped_no_place_id}`);
  console.log(`failed:               ${failed}`);
  if (failedSlugs.length > 0) {
    console.log('\nFailed slugs:');
    for (const s of failedSlugs) console.log(`  - ${s}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
