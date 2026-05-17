import { describe, it, expect } from 'vitest';
import { parseTakeoutCsv, escapeYaml, toMarkdown } from '../scripts/import-takeout.mjs';

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

  it('strips UTF-8 BOM from header', () => {
    const csv = '﻿Title,Note,URL\n"Foo","","https://maps.google.com/?q=43,3"\n';
    const rows = parseTakeoutCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Foo');
  });

  it('handles multi-line notes in quoted fields', () => {
    const csv = 'Title,Note,URL\n"Foo","Ligne 1\nLigne 2","https://maps.google.com/?q=43,3"\n"Bar","","https://maps.google.com/?q=44,4"\n';
    const rows = parseTakeoutCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Foo');
    expect(rows[0].note).toBe('Ligne 1\nLigne 2');
    expect(rows[1].title).toBe('Bar');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const csv = 'Title,Note,URL\n"Bar ""Pirate""","",""\n';
    const rows = parseTakeoutCsv(csv);
    expect(rows[0].title).toBe('Bar "Pirate"');
  });
});

describe('parseTakeoutCsv – Tags and Comment columns', () => {
  it('extracts tags and comment when present', () => {
    const csv = `Title,Note,URL,Tags,Comment\n"Urfa Dürüm","","https://www.google.com/maps/place/Urfa","Kebab,Turkish","Great place"\n`;
    const rows = parseTakeoutCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].tags).toBe('Kebab,Turkish');
    expect(rows[0].comment).toBe('Great place');
  });

  it('returns empty strings for tags and comment when columns are absent', () => {
    const csv = `Title,Note,URL\n"Le Spot","","https://www.google.com/maps/place/Foo"\n`;
    const rows = parseTakeoutCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].tags).toBe('');
    expect(rows[0].comment).toBe('');
  });
});

describe('toMarkdown', () => {
  const baseRow = {
    title: 'Urfa Dürüm',
    note: '',
    url: 'https://www.google.com/maps/place/Urfa',
    coords: { lat: 43.6, lon: 3.87 },
    tags: '',
    comment: '',
  };

  it('includes tags in frontmatter when present', () => {
    const row = { ...baseRow, tags: 'Kebab,Turkish' };
    const { content } = toMarkdown(row);
    expect(content).toContain('tags: "Kebab,Turkish"');
  });

  it('omits tags from frontmatter when empty', () => {
    const { content } = toMarkdown(baseRow);
    expect(content).not.toContain('tags:');
  });

  it('includes comment in frontmatter when present', () => {
    const row = { ...baseRow, comment: 'Great place' };
    const { content } = toMarkdown(row);
    expect(content).toContain('comment: "Great place"');
  });

  it('omits comment from frontmatter when empty', () => {
    const { content } = toMarkdown(baseRow);
    expect(content).not.toContain('comment:');
  });
});

describe('escapeYaml', () => {
  it('escapes double quotes', () => {
    expect(escapeYaml('Foo "Bar"')).toBe('"Foo \\"Bar\\""');
  });
  it('escapes backslashes', () => {
    expect(escapeYaml('Foo\\Bar')).toBe('"Foo\\\\Bar"');
  });
  it('replaces newlines with a space', () => {
    expect(escapeYaml('Foo\nBar\r\nBaz')).toBe('"Foo Bar Baz"');
  });
});
