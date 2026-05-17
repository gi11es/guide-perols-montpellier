#!/usr/bin/env node
// Build a Protomaps .pmtiles file for the ~100km region around Pérols.
//
// Prereqs (one-time, user installs):
//   brew install protomaps/tap/go-pmtiles
//
// Source: Protomaps daily-built planet via HTTP range requests
// (no full-planet download — pmtiles extract uses range requests).

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const TILES_DIR = join(ROOT, 'public', 'tiles');
const TARGET = join(TILES_DIR, 'perols-100km.pmtiles');

// Bounding box ~100km around Pérols (43.565, 3.945).
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

  // Protomaps publishes a daily-built world basemap.
  // Find the latest at https://maps.protomaps.com/builds (download URL pattern).
  // Update DATE below when stale.
  const DATE = '20260401';
  const SOURCE_URL = `https://build.protomaps.com/${DATE}.pmtiles`;

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
