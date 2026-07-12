import { describe, expect, it } from 'vitest';
import { buildRepeaterBookUpstreamUrl } from './repeaterbookUpstream.ts';

describe('buildRepeaterBookUpstreamUrl', () => {
  it('builds NA export URL with whitelisted params only', () => {
    const params = new URLSearchParams({
      region: 'na',
      state_id: '06',
      callsign: 'W6%',
      evil: 'drop-me',
    });
    const url = buildRepeaterBookUpstreamUrl('na', params);
    expect(url.origin).toBe('https://www.repeaterbook.com');
    expect(url.pathname).toBe('/api/export.php');
    expect(url.searchParams.get('state_id')).toBe('06');
    expect(url.searchParams.get('callsign')).toBe('W6%');
    expect(url.searchParams.get('region')).toBeNull();
    expect(url.searchParams.get('evil')).toBeNull();
  });

  it('builds ROW export URL and keeps geographic region filters', () => {
    const params = new URLSearchParams({
      region: 'row',
      country: 'Switzerland',
    });
    const url = buildRepeaterBookUpstreamUrl('row', params);
    expect(url.pathname).toBe('/api/exportROW.php');
    expect(url.searchParams.get('country')).toBe('Switzerland');
    expect(url.searchParams.get('region')).toBeNull();
  });

  it('forwards geographic region on ROW when not na|row routing value', () => {
    const params = new URLSearchParams({
      region: 'Europe',
      country: 'Switzerland',
    });
    const url = buildRepeaterBookUpstreamUrl('row', params);
    expect(url.searchParams.get('region')).toBe('Europe');
  });
});
