import { buildNavItems } from './nav.ts';
import { newFormatBuild } from '@core/domain/factories.ts';
import { describe, expect, it } from 'vitest';

describe('buildNavItems', () => {
  it('includes Radio characteristics after Overview', () => {
    const build = { ...newFormatBuild('proj', 'opengd77-1701'), formatId: 'opengd77' };
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels[0]).toBe('Overview');
    expect(labels[1]).toBe('Radio characteristics');
  });

  it('includes Airband for Anytone builds', () => {
    const build = { ...newFormatBuild('proj', 'anytone-at-d890uv'), formatId: 'anytone' };
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels).toContain('Airband');
    expect(labels.indexOf('Airband')).toBeGreaterThan(labels.indexOf('Channels'));
  });

  it('omits Airband for non-Anytone builds', () => {
    const build = { ...newFormatBuild('proj', 'opengd77-1701'), formatId: 'opengd77' };
    expect(buildNavItems(build).map((item) => item.label)).not.toContain('Airband');
  });
});
