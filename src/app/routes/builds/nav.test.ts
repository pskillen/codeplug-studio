import {
  activeBuildSection,
  allBuildDetailPaths,
  buildAuditNavItems,
  buildSectionNavItems,
  BUILD_SECTION_ABOUT,
  BUILD_SECTION_BACKUP,
  BUILD_SECTION_EXPORT,
  BUILD_SECTION_EXPORT_SETTINGS,
  BUILD_SECTION_OVERVIEW,
  BUILD_SECTION_SATELLITE_KEPS,
  BUILD_SECTION_WIRE_PREVIEW,
  buildNavItems,
  pathForSwitchedBuild,
  showsSatelliteKepsNav,
} from './nav.ts';
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

function withHydration(egress: EgressPath, hydration: EgressPath['hydration']): EgressPath {
  return { ...egress, hydration };
}

describe('buildNavItems', () => {
  it('puts Export first, then Overview and Radio characteristics', () => {
    const build = newFormatBuild('proj', 'opengd77-1701');
    const labels = buildNavItems(build).map((item) => item.label);
    expect(labels[0]).toBe('Export');
    expect(labels[1]).toBe('Overview');
    expect(labels[2]).toBe('Radio characteristics');
  });

  it('includes Airband only when the active egress is AT-D890UV (CSV or Web Serial)', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    expect(buildNavItems(build).map((item) => item.label)).not.toContain('Airband');
    expect(buildNavItems(build).map((item) => item.label)).not.toContain('AM airband');
    const csvLabels = buildNavItems(build, { activeEgress: egress }).map((item) => item.label);
    expect(csvLabels).toContain('AM airband');
    expect(csvLabels.indexOf('AM airband')).toBeGreaterThan(csvLabels.indexOf('Channels'));

    const serialEgress =
      egressPaths.find((path) => path.profileId === 'radio-io-at-d890uv') ?? egress;
    const serialLabels = buildNavItems(build, { activeEgress: serialEgress }).map(
      (item) => item.label,
    );
    expect(serialLabels).toContain('AM airband');
  });

  it('includes AM airband for D890 builds when egress paths exist but active egress is unset', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    const labels = buildNavItems(build, { egressPaths }).map((item) => item.label);
    expect(labels).toContain('AM airband');
  });

  it('does not include AM airband for non-D890 radio targets', () => {
    const { build, egress } = newRadioBuildForProfile('proj', 'opengd77-1701');
    expect(buildNavItems(build, { activeEgress: egress }).map((item) => item.label)).not.toContain(
      'AM airband',
    );
    expect(buildNavItems(build, { activeEgress: egress }).map((item) => item.label)).not.toContain(
      'Airband',
    );
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

  it('does not include Radio Info in About nav when a Web Serial egress exists', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    expect(buildNavItems(build, { egressPaths }).map((item) => item.label)).not.toContain(
      'Radio Info',
    );
    expect(buildAuditNavItems(build, { egressPaths }).map((item) => item.label)).not.toContain(
      'Radio Info',
    );
  });

  it('includes Backup / Restore in the strip for OpenGD77 DM-1701 Web Serial builds', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-opengd77-1701');
    const csvActive = egressPaths.find((path) => path.formatId === 'opengd77') ?? egressPaths[0]!;
    const labels = buildSectionNavItems(build, {
      egressPaths,
      activeEgress: csvActive,
    }).map((item) => item.label);
    expect(labels).toContain(BUILD_SECTION_BACKUP);
    expect(csvActive.formatId).toBe('opengd77');
  });

  it('includes both retain viewers when NeonPlug donor and Web Serial egress exist', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    const withDonor = egressPaths.map((path) => {
      if (path.formatId === 'neonplug') return withHydration(path, neonplugDonorHydration);
      return path;
    });
    const labels = buildNavItems(build, { egressPaths: withDonor }).map((item) => item.label);
    expect(labels).toContain('NeonPlug settings');
    expect(labels).not.toContain('Radio Info');
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

describe('buildSectionNavItems', () => {
  it('lists mk2 section order Overview, Export, Export settings, Wire preview, About', () => {
    const build = newFormatBuild('proj', 'opengd77-1701');
    const labels = buildSectionNavItems(build).map((item) => item.label);
    expect(labels).toEqual([
      BUILD_SECTION_OVERVIEW,
      BUILD_SECTION_EXPORT,
      BUILD_SECTION_EXPORT_SETTINGS,
      BUILD_SECTION_WIRE_PREVIEW,
      BUILD_SECTION_ABOUT,
    ]);
  });

  it('omits Satellite keps for a profile with no keps write adapter', () => {
    const build = newFormatBuild('proj', 'opengd77-1701');
    expect(buildSectionNavItems(build).map((item) => item.label)).not.toContain(
      BUILD_SECTION_SATELLITE_KEPS,
    );
  });

  it('includes Satellite keps, between Wire preview and About, for a build with a D890 Web Serial egress', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    const labels = buildSectionNavItems(build, { egressPaths }).map((item) => item.label);
    expect(labels).toContain(BUILD_SECTION_SATELLITE_KEPS);
    expect(labels.indexOf(BUILD_SECTION_SATELLITE_KEPS)).toBeGreaterThan(
      labels.indexOf(BUILD_SECTION_WIRE_PREVIEW),
    );
    expect(labels.indexOf(BUILD_SECTION_SATELLITE_KEPS)).toBeLessThan(
      labels.indexOf(BUILD_SECTION_ABOUT),
    );
  });

  it('includes Backup / Restore after Satellite keps and before About when Web Serial egress exists', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    const labels = buildSectionNavItems(build, { egressPaths }).map((item) => item.label);
    expect(labels).toContain(BUILD_SECTION_BACKUP);
    expect(labels.indexOf(BUILD_SECTION_BACKUP)).toBeGreaterThan(
      labels.indexOf(BUILD_SECTION_SATELLITE_KEPS),
    );
    expect(labels.indexOf(BUILD_SECTION_BACKUP)).toBeLessThan(labels.indexOf(BUILD_SECTION_ABOUT));
  });

  it('omits Backup / Restore when the build has no Web Serial egress', () => {
    const build = newFormatBuild('proj', 'opengd77-1701');
    expect(buildSectionNavItems(build).map((item) => item.label)).not.toContain(
      BUILD_SECTION_BACKUP,
    );
  });

  it('links Backup / Restore to /builds/:id/backup', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    const item = buildSectionNavItems(build, { egressPaths }).find(
      (i) => i.label === BUILD_SECTION_BACKUP,
    );
    expect(item?.path).toBe(`/builds/${build.id}/backup`);
    expect(item?.section).toBe('backup');
  });

  it('links Satellite keps to /builds/:id/satellite-keps', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    const item = buildSectionNavItems(build, { egressPaths }).find(
      (i) => i.label === BUILD_SECTION_SATELLITE_KEPS,
    );
    expect(item?.path).toBe(`/builds/${build.id}/satellite-keps`);
  });
});

describe('showsSatelliteKepsNav', () => {
  it('is false for a build with no egress path carrying a keps write adapter', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'neonplug-dm32uv');
    expect(showsSatelliteKepsNav(build, { egressPaths })).toBe(false);
  });

  it('is true when any egress path on the build has a keps write adapter', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    expect(showsSatelliteKepsNav(build, { egressPaths })).toBe(true);
  });
});

describe('allBuildDetailPaths', () => {
  it('includes satellite-keps only when the build has a keps-capable egress', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    expect(allBuildDetailPaths(build, { egressPaths })).toContain(
      `/builds/${build.id}/satellite-keps`,
    );

    const noKeps = newRadioBuildForProfile('proj', 'neonplug-dm32uv');
    expect(allBuildDetailPaths(noKeps.build, { egressPaths: noKeps.egressPaths })).not.toContain(
      `/builds/${noKeps.build.id}/satellite-keps`,
    );
  });

  it('includes backup only when the build has a Web Serial egress', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    expect(allBuildDetailPaths(build, { egressPaths })).toContain(`/builds/${build.id}/backup`);
    expect(allBuildDetailPaths(build, { egressPaths })).not.toContain(
      `/builds/${build.id}/radio-info`,
    );

    const { build: csvBuild, egressPaths: csvPaths } = newRadioBuildForProfile(
      'proj',
      'chirp-uv5r',
    );
    const noSerial = csvPaths.filter((path) => path.formatId !== 'radio-io');
    expect(allBuildDetailPaths(csvBuild, { egressPaths: noSerial })).not.toContain(
      `/builds/${csvBuild.id}/backup`,
    );
  });
});

describe('activeBuildSection', () => {
  const build = newFormatBuild('proj', 'opengd77-1701');

  it('maps wire routes to wire-preview section', () => {
    expect(activeBuildSection(`/builds/${build.id}/channels`, build.id)).toBe('wire-preview');
    expect(activeBuildSection(`/builds/${build.id}/channels/bulk`, build.id)).toBe('wire-preview');
  });

  it('maps about routes to audit section', () => {
    expect(activeBuildSection(`/builds/${build.id}/characteristics`, build.id)).toBe('audit');
    expect(activeBuildSection(`/builds/${build.id}/export-resolution`, build.id)).toBe('audit');
  });

  it('maps export, export settings, and overview', () => {
    expect(activeBuildSection(`/builds/${build.id}/export`, build.id)).toBe('export');
    expect(activeBuildSection(`/builds/${build.id}/export/settings`, build.id)).toBe(
      'export-settings',
    );
    expect(activeBuildSection(`/builds/${build.id}/overview`, build.id)).toBe('overview');
  });

  it('maps the satellite-keps route to the satellite-keps section', () => {
    expect(activeBuildSection(`/builds/${build.id}/satellite-keps`, build.id)).toBe(
      'satellite-keps',
    );
  });

  it('maps the backup route (and retired Radio Info URLs) to the backup section', () => {
    expect(activeBuildSection(`/builds/${build.id}/backup`, build.id)).toBe('backup');
    expect(activeBuildSection(`/builds/${build.id}/radio-info`, build.id)).toBe('backup');
    expect(activeBuildSection(`/builds/${build.id}/radio-image`, build.id)).toBe('backup');
  });
});

describe('buildAuditNavItems', () => {
  it('includes NeonPlug settings when donor bag exists', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'neonplug-dm32uv');
    const withDonor = egressPaths.map((path) =>
      path.id === egress.id ? withHydration(path, neonplugDonorHydration) : path,
    );
    expect(
      buildAuditNavItems(build, { egressPaths: withDonor }).map((item) => item.label),
    ).toContain('NeonPlug settings');
  });

  it('does not include Radio Info', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    expect(buildAuditNavItems(build, { egressPaths }).map((item) => item.label)).not.toContain(
      'Radio Info',
    );
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

  it('preserves nested wire paths when the target exposes them', () => {
    expect(pathForSwitchedBuild(`/builds/${from.id}/channels/bulk`, from.id, toOpenGd77)).toBe(
      `/builds/${toOpenGd77.id}/channels/bulk`,
    );
  });

  it('falls back to export for retain routes when egress bags are unknown', () => {
    expect(pathForSwitchedBuild(`/builds/${from.id}/neonplug-settings`, from.id, toOpenGd77)).toBe(
      `/builds/${toOpenGd77.id}/export`,
    );
    expect(pathForSwitchedBuild(`/builds/${from.id}/radio-info`, from.id, toChirp)).toBe(
      `/builds/${toChirp.id}/export`,
    );
  });

  it('maps retired radio-info paths onto backup when the target has Web Serial', () => {
    const { build: toSerial, egressPaths } = newRadioBuildForProfile('proj', 'radio-io-uv5r-mini');
    expect(
      pathForSwitchedBuild(`/builds/${from.id}/radio-info`, from.id, toSerial, { egressPaths }),
    ).toBe(`/builds/${toSerial.id}/backup`);
  });
});
