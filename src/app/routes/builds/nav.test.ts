import { buildNavItems, pathForSwitchedBuild } from './nav.ts';
import { newFormatBuild } from '@core/domain/factories.ts';
import { describe, expect, it } from 'vitest';

describe('buildNavItems', () => {
  it('puts Export first, then Setup and Radio characteristics', () => {
    const build = { ...newFormatBuild('proj', 'opengd77-1701'), formatId: 'opengd77' };
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels[0]).toBe('Export');
    expect(labels[1]).toBe('Setup');
    expect(labels[2]).toBe('Radio characteristics');
  });

  it('includes Airband for Anytone builds', () => {
    const build = { ...newFormatBuild('proj', 'anytone-at-d890uv'), formatId: 'anytone' };
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels).toContain('Airband');
    expect(labels.indexOf('Airband')).toBeGreaterThan(labels.indexOf('Channels'));
  });

  it('includes NeonPlug settings for DM32UV NeonPlug builds', () => {
    const build = { ...newFormatBuild('proj', 'neonplug-dm32uv'), formatId: 'neonplug' };
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels).toContain('NeonPlug settings');
  });

  it('omits NeonPlug settings for UV5R NeonPlug builds', () => {
    const build = { ...newFormatBuild('proj', 'neonplug-uv5rmini'), formatId: 'neonplug' };
    expect(buildNavItems(build).map((item) => item.label)).not.toContain('NeonPlug settings');
  });
});

describe('pathForSwitchedBuild', () => {
  const from = { ...newFormatBuild('proj', 'opengd77-1701'), formatId: 'opengd77' as const };
  const toOpenGd77 = {
    ...newFormatBuild('proj', 'opengd77-1701'),
    id: 'target-ogd',
    formatId: 'opengd77' as const,
  };
  const toChirp = {
    ...newFormatBuild('proj', 'chirp-uv5r'),
    id: 'target-chirp',
    formatId: 'chirp' as const,
  };

  it('preserves a shared sub-route', () => {
    expect(pathForSwitchedBuild(`/builds/${from.id}/channels`, from.id, toOpenGd77)).toBe(
      `/builds/${toOpenGd77.id}/channels`,
    );
  });

  it('falls back to export when the target lacks the route', () => {
    expect(pathForSwitchedBuild(`/builds/${from.id}/zones`, from.id, toChirp)).toBe(
      `/builds/${toChirp.id}/export`,
    );
  });

  it('maps nested paths to the parent nav item when present', () => {
    expect(pathForSwitchedBuild(`/builds/${from.id}/channels/bulk`, from.id, toOpenGd77)).toBe(
      `/builds/${toOpenGd77.id}/channels`,
    );
  });
});
