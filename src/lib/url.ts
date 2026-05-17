import type { LatLon } from './geo';

export function extractCoordsFromGmapsUrl(url: string): LatLon | null {
  if (!/google\.[a-z.]+\/maps/.test(url) && !url.includes('maps.app.goo.gl')) {
    return null;
  }
  const dm = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dm) return { lat: parseFloat(dm[1]), lon: parseFloat(dm[2]) };
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return { lat: parseFloat(at[1]), lon: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (q) return { lat: parseFloat(q[1]), lon: parseFloat(q[2]) };
  return null;
}

export async function resolveShortUrl(url: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' });
  return res.url;
}
