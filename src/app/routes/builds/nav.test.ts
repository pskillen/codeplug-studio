import { buildNavItems, pathForSwitchedBuild } from './nav.ts';
import { newFormatBuild, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { describe, expect, it } from 'vitest';

const neonplugDonorHydration = {
  formatId: 'neonplug' as const,
  sourceFileName: 'radio.neonplug',
  capturedAt: '2026-07-20T12:00:00.000Z',
  retain: {
    radioIds: [],
    quickContacts: [],
    messages: [],
    digitalEmergencies: [],
    analogEmergencies: [],
    encryptionKeys: [],
    digitalEmergencyConfig: null,
    radioSettings: { powerOnDisplayLine1: 'X' },
    radioInfo: { model: 'DP570UV' },
  },
};

const radioCloneHydration = {
  formatId: 'radio-clone' as const,
  sourceFileName: 'web-serial',
  capturedAt: '2026-07-23T12:00:00.000Z',
  retain: {
    radioModelId: 'UV5R-Mini',
    capturedVia: 'web-serial' as const,
    imageBase64: 'AAAA',
    imageByteLength: 3,
  },
};

function withHydration(egress: EgressPath, hydration: EgressPath['hydration']): EgressPath {
  return { ...egress, hydration };
}

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

  it('includes NeonPlug settings when a donor bag exists, even if NeonPlug is not active', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'neonplug-dm32uv');
    expect(buildNavItems(build, { egressPaths }).map((item) => item.label)).not.toContain(
      'NeonPlug settings',
    );
    const withDonor = egressPaths.map((path) =>
      path.id === egress.id ? withHydration(path, neonplugDonorHydration) : path,
    );
    const chirpActive = withDonor.find((path) => path.formatId === 'dm32') ?? withDonor[0]!;
    const labels = buildNavItems(build, {
      egressPaths: withDonor,
      activeEgress: chirpActive,
    }).map((item) => item.label);
    expect(labels).toContain('NeonPlug settings');
    expect(chirpActive.formatId).not.toBe('neonplug');
  });

  it('includes NeonPlug settings for UV5R when a donor bag is stored', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'neonplug-uv5rmini');
    const withDonor = egressPaths.map((path) =>
      path.id === egress.id ? withHydration(path, neonplugDonorHydration) : path,
    );
    expect(
      buildNavItems(build, { egressPaths: withDonor, activeEgress: egress }).map(
        (item) => item.label,
      ),
    ).toContain('NeonPlug settings');
  });

  it('includes Radio image when a clone bag exists, even if Direct radio is not active', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    expect(buildNavItems(build, { egressPaths }).map((item) => item.label)).not.toContain(
      'Radio image',
    );
    const withClone = egressPaths.map((path) =>
      path.id === egress.id ? withHydration(path, radioCloneHydration) : path,
    );
    const nonSerial = withClone.find((path) => path.formatId !== 'radio-io') ?? withClone[0]!;
    const labels = buildNavItems(build, {
      egressPaths: withClone,
      activeEgress: nonSerial,
    }).map((item) => item.label);
    expect(labels).toContain('Radio image');
    expect(labels).not.toContain('NeonPlug settings');
  });

  it('includes Radio image for OpenGD77 DM-1701 when a clone bag exists', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-opengd77-1701');
    const withClone = egressPaths.map((path) =>
      path.id === egress.id
        ? withHydration(path, {
            ...radioCloneHydration,
            retain: { ...radioCloneHydration.retain, radioModelId: 'DM-1701' },
          })
        : path,
    );
    const csvActive = withClone.find((path) => path.formatId === 'opengd77') ?? withClone[0]!;
    const labels = buildNavItems(build, {
      egressPaths: withClone,
      activeEgress: csvActive,
    }).map((item) => item.label);
    expect(labels).toContain('Radio image');
    expect(csvActive.formatId).toBe('opengd77');
  });

  it('includes both retain viewers when both bags exist on one build', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    const withBoth = egressPaths.map((path) => {
      if (path.formatId === 'neonplug') return withHydration(path, neonplugDonorHydration);
      if (path.formatId === 'radio-io') return withHydration(path, radioCloneHydration);
      return path;
    });
    const labels = buildNavItems(build, { egressPaths: withBoth }).map((item) => item.label);
    expect(labels).toContain('NeonPlug settings');
    expect(labels).toContain('Radio image');
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

  it('falls back to export for retain routes when egress bags are unknown', () => {
    expect(pathForSwitchedBuild(`/builds/${from.id}/neonplug-settings`, from.id, toOpenGd77)).toBe(
      `/builds/${toOpenGd77.id}/export`,
    );
  });
});
