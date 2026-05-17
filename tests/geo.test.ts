import { describe, it, expect } from 'vitest';
import { haversineKm, withinRadiusKm } from '~/lib/geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: 43.5650, lon: 3.9450 }, { lat: 43.5650, lon: 3.9450 })).toBe(0);
  });

  it('computes Pérols → Nîmes (~45km) within 2km tolerance', () => {
    const perols = { lat: 43.5650, lon: 3.9450 };
    const nimes = { lat: 43.8367, lon: 4.3601 };
    const d = haversineKm(perols, nimes);
    expect(d).toBeGreaterThan(43);
    expect(d).toBeLessThan(47);
  });

  it('computes Pérols → Paris (~600km, well beyond 100km)', () => {
    const perols = { lat: 43.5650, lon: 3.9450 };
    const paris = { lat: 48.8566, lon: 2.3522 };
    expect(haversineKm(perols, paris)).toBeGreaterThan(500);
  });
});

describe('withinRadiusKm', () => {
  const perols = { lat: 43.5650, lon: 3.9450 };
  it('returns true for self', () => {
    expect(withinRadiusKm(perols, perols, 100)).toBe(true);
  });
  it('returns true for Nîmes within 100km', () => {
    expect(withinRadiusKm(perols, { lat: 43.8367, lon: 4.3601 }, 100)).toBe(true);
  });
  it('returns false for Paris beyond 100km', () => {
    expect(withinRadiusKm(perols, { lat: 48.8566, lon: 2.3522 }, 100)).toBe(false);
  });
});
