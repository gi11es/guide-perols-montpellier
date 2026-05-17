import { describe, it, expect } from 'vitest';
import { slugify } from '~/lib/slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Le Petit Bouchon')).toBe('le-petit-bouchon');
  });
  it('strips French diacritics', () => {
    expect(slugify('Café de la Plage')).toBe('cafe-de-la-plage');
    expect(slugify('Crêperie Bretonne — Sète')).toBe('creperie-bretonne-sete');
  });
  it('collapses repeated separators', () => {
    expect(slugify('  A  &  B  ')).toBe('a-b');
  });
  it('keeps numbers', () => {
    expect(slugify('Bar 24')).toBe('bar-24');
  });
});
