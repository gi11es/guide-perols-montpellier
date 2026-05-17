import { describe, it, expect } from 'vitest';
import { parseTakeoutCsv } from '../scripts/import-takeout.mjs';

describe('parseTakeoutCsv', () => {
  it('parses a Saved-list CSV row', () => {
    const csv = `Title,Note,URL\n"Le Petit Bouchon","Bon resto","https://www.google.com/maps/place/Foo/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d43.5709!4d3.9519!16s"\n`;
    const rows = parseTakeoutCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      title: 'Le Petit Bouchon',
      note: 'Bon resto',
    });
    expect(rows[0].url).toContain('google.com/maps');
  });

  it('handles commas in quoted fields', () => {
    const csv = `Title,Note,URL\n"Foo, Bar","",""\n`;
    const rows = parseTakeoutCsv(csv);
    expect(rows[0].title).toBe('Foo, Bar');
  });

  it('returns empty for empty input', () => {
    expect(parseTakeoutCsv('Title,Note,URL\n')).toEqual([]);
  });
});
