import { buildNavItems, pathForSwitchedBuild } from './nav.ts';
import { newFormatBuild, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { describe, expect, it } from 'vitest';

describe('buildNavItems', () => {
  it('puts Export first, then Setup and Radio characteristics', () => {
    const build = newFormatBuild('proj', 'opengd77-1701');
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels[0]).toBe('Export');
    expect(labels[1]).toBe('Setup');
    expect(labels[2]).toBe('Radio characteristics');
  });

  it('includes Airband only when the active egress is Anytone', () => {
    const { build, egress } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    expect(buildNavItems(build).map((item) => item.label)).not.toContain('Airband');
    const labels = buildNavItems(build, { activeEgress: egress }).map((item) => item.label);
    expect(labels).toContain('Airband');
    expect(labels.indexOf('Airband')).toBeGreaterThan(labels.indexOf('Channels'));
  });

  it('includes NeonPlug settings only when the active egress is NeonPlug', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'neonplug-dm32uv');
    expect(buildNavItems(build, { egressPaths }).map((item) => item.label)).not.toContain(
      'NeonPlug settings',
    );
    expect(
      buildNavItems(build, { egressPaths, activeEgress: egress }).map((item) => item.label),
    ).toContain('NeonPlug settings');
  });

  it('includes NeonPlug settings for UV5R when NeonPlug egress is active', () => {
    const { build, egress } = newRadioBuildForProfile('proj', 'neonplug-uv5rmini');
    expect(buildNavItems(build, { activeEgress: egress }).map((item) => item.label)).toContain(
      'NeonPlug settings',
    );
  });

  it('includes Radio image only when the active egress is Direct radio', () => {
    const { build, egress } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    expect(buildNavItems(build, { egressPaths: [egress] }).map((item) => item.label)).not.toContain(
      'Radio image',
    );
    const labels = buildNavItems(build, { activeEgress: egress }).map((item) => item.label);
    expect(labels).toContain('Radio image');
    expect(labels).not.toContain('NeonPlug settings');
  });

  it('includes Scan list after Channels for flat-memory UV5R builds', () => {
    const build = newFormatBuild('proj', 'neonplug-uv5rmini');
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels).toContain('Scan list');
    expect(labels.indexOf('Scan list')).toBe(labels.indexOf('Channels') + 1);
    expect(labels).not.toContain('Scan lists');
  });

  it('includes Scan list for CHIRP UV-5R builds', () => {
    const build = newFormatBuild('proj', 'chirp-uv5r');
    expect(buildNavItems(build).map((item) => item.label)).toContain('Scan list');
  });
});

describe('pathForSwitchedBuild', () => {
  const from = newFormatBuild('proj', 'opengd77-1701');
  const toOpenGd77 = {
    ...newFormatBuild('proj', 'opengd77-1701'),
    id: 'target-ogd',
  };
  const toChirp = {
    ...newFormatBuild('proj', 'chirp-uv5r'),
    id: 'target-chirp',
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

  it('falls back to export for retain routes when active egress is unknown', () => {
    expect(pathForSwitchedBuild(`/builds/${from.id}/neonplug-settings`, from.id, toOpenGd77)).toBe(
      `/builds/${toOpenGd77.id}/export`,
    );
  });
});
