import { describe, it, expect } from 'vitest';
import { extractCoordsFromGmapsUrl } from '~/lib/url';

describe('extractCoordsFromGmapsUrl', () => {
  it('extracts from !3d!4d pattern', () => {
    const url = 'https://www.google.com/maps/place/Foo/data=!3m1!4b1!4m6!3m5!1s0x0!8m2!3d43.5709!4d3.9519!16s';
    expect(extractCoordsFromGmapsUrl(url)).toEqual({ lat: 43.5709, lon: 3.9519 });
  });

  it('extracts from @lat,lon, pattern', () => {
    const url = 'https://www.google.com/maps/place/Foo/@43.5709,3.9519,17z';
    expect(extractCoordsFromGmapsUrl(url)).toEqual({ lat: 43.5709, lon: 3.9519 });
  });

  it('extracts from q=lat,lon query param', () => {
    const url = 'https://www.google.com/maps?q=43.5709,3.9519';
    expect(extractCoordsFromGmapsUrl(url)).toEqual({ lat: 43.5709, lon: 3.9519 });
  });

  it('returns null when no coords found', () => {
    expect(extractCoordsFromGmapsUrl('https://www.google.com/maps/place/Foo')).toBeNull();
  });

  it('returns null for non-google URL', () => {
    expect(extractCoordsFromGmapsUrl('https://example.com')).toBeNull();
  });
});
