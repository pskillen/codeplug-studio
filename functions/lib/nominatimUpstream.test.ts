import { describe, expect, it } from 'vitest';
import { buildNominatimSearchUpstreamUrl } from './nominatimUpstream.ts';

describe('buildNominatimSearchUpstreamUrl', () => {
  it('forwards the trimmed query and pins format to jsonv2', () => {
    const url = buildNominatimSearchUpstreamUrl(new URLSearchParams({ q: '  IO85vs  ' }));
    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('IO85vs');
    expect(url.searchParams.get('format')).toBe('jsonv2');
  });

  it('omits q when blank', () => {
    const url = buildNominatimSearchUpstreamUrl(new URLSearchParams({ q: '   ' }));
    expect(url.searchParams.has('q')).toBe(false);
  });

  it('clamps limit to the Studio ceiling and drops invalid values', () => {
    const clamped = buildNominatimSearchUpstreamUrl(new URLSearchParams({ q: 'x', limit: '50' }));
    expect(clamped.searchParams.get('limit')).toBe('10');

    const invalid = buildNominatimSearchUpstreamUrl(new URLSearchParams({ q: 'x', limit: 'nope' }));
    expect(invalid.searchParams.has('limit')).toBe(false);

    const negative = buildNominatimSearchUpstreamUrl(new URLSearchParams({ q: 'x', limit: '-1' }));
    expect(negative.searchParams.has('limit')).toBe(false);
  });

  it('drops params outside the passthrough allowlist', () => {
    const url = buildNominatimSearchUpstreamUrl(
      new URLSearchParams({ q: 'x', evil: 'drop-me', email: 'operator@example.com' }),
    );
    expect(url.searchParams.has('evil')).toBe(false);
    expect(url.searchParams.has('email')).toBe(false);
  });
});
