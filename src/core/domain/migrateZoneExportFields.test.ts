import { describe, expect, it } from 'vitest';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Library, Zone } from '@core/models/library.ts';
import { initialRevision } from '@core/models/revision.ts';
import {
  migrateProjectAggregate,
  migrateZoneExportFieldsToBuildLayout,
  readLegacyZoneExportFields,
  stripZoneExportFields,
} from './migrateZoneExportFields.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_ID = '44444444-4444-4444-8444-444444444444';

function legacyZone(): Zone & {
  exportScratchChannel: boolean;
  exportScanList: boolean;
  scanCarrierFrequencyHz: number;
} {
  return {
    id: ZONE_ID,
    projectId: PROJECT_ID,
    revision: initialRevision(),
    updatedAt: '2026-07-02T10:00:00.000Z',
    name: 'Edinburgh',
    members: [{ kind: 'channel', channelId: '22222222-2222-4222-8222-222222222222' }],
    exportScratchChannel: false,
    exportScanList: true,
    scanCarrierFrequencyHz: 430_912_500,
    comment: '',
  };
}

function dm32Build(): FormatBuild {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    projectId: PROJECT_ID,
    revision: initialRevision(),
    updatedAt: '2026-07-02T10:00:00.000Z',
    formatId: 'dm32',
    profileId: 'dm32-baofeng-dm32uv',
    name: 'DM32',
    layout: { sections: [] },
    channelOverrides: [],
    zoneOverrides: [],
    talkGroupOverrides: [],
    rxGroupListOverrides: [],
    contactOverrides: [],
    scanListOverrides: [],
    exportUnlinkedChannels: true,
    exportUnlinkedTalkGroups: true,
    exportUnlinkedRxGroupLists: true,
  };
}

describe('migrateZoneExportFields', () => {
  it('reads and strips legacy zone export fields', () => {
    const zone = legacyZone();
    expect(readLegacyZoneExportFields(zone)).toEqual({
      exportScratchChannel: false,
      exportScanList: true,
      scanCarrierFrequencyHz: 430_912_500,
    });
    expect(stripZoneExportFields(zone)).not.toHaveProperty('exportScanList');
  });

  it('moves library zone export flags onto dm32 build zone grouping layout', () => {
    const library: Library = {
      channels: [],
      zones: [legacyZone()],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelDefaults: {
        forbidTransmit: false,
        txPermit: 'permitAlways',
        sendTalkerAlias: 'on',
        analogSquelchMode: 'carrier',
      },
      zoneDefaults: { includeInZoneDerivedScanList: true },
      aprsConfiguration: null,
    };

    const { library: nextLibrary, formatBuilds } = migrateZoneExportFieldsToBuildLayout(library, [
      dm32Build(),
    ]);

    expect(nextLibrary.zones[0]).not.toHaveProperty('exportScanList');
    const section = formatBuilds[0]!.layout.sections.find((s) => s.kind === 'zoneGrouping');
    expect(section?.kind).toBe('zoneGrouping');
    if (section?.kind !== 'zoneGrouping') throw new Error('expected zoneGrouping');
    expect(section.zones[0]).toMatchObject({
      id: ZONE_ID,
      exportScanList: true,
      scanCarrierFrequencyHz: 430_912_500,
    });
  });

  it('migrates dm32-default profile id to dm32-baofeng-dm32uv', () => {
    const library: Library = {
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelDefaults: {
        forbidTransmit: false,
        txPermit: 'permitAlways',
        sendTalkerAlias: 'on',
        analogSquelchMode: 'carrier',
      },
      zoneDefaults: { includeInZoneDerivedScanList: true },
      aprsConfiguration: null,
    };
    const { formatBuilds } = migrateZoneExportFieldsToBuildLayout(library, [
      { ...dm32Build(), profileId: 'dm32-default' },
    ]);
    expect(formatBuilds[0]!.profileId).toBe('dm32-baofeng-dm32uv');
  });

  it('migrateProjectAggregate cleans zones and updates builds', () => {
    const result = migrateProjectAggregate({
      meta: {
        id: PROJECT_ID,
        projectId: PROJECT_ID,
        revision: initialRevision(),
        updatedAt: '2026-07-02T10:00:00.000Z',
        name: 'Test',
        author: '',
        description: '',
        notes: '',
        createdAt: '2026-07-02T10:00:00.000Z',
      },
      channels: [],
      zones: [legacyZone()],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelDefaults: {
        forbidTransmit: false,
        txPermit: 'permitAlways',
        sendTalkerAlias: 'on',
        analogSquelchMode: 'carrier',
      },
      aprsConfiguration: null,
      formatBuilds: [dm32Build()],
    });

    expect(result.zones[0]).not.toHaveProperty('exportScanList');
    const section = result.formatBuilds[0]!.layout.sections.find((s) => s.kind === 'zoneGrouping');
    expect(section?.kind).toBe('zoneGrouping');
  });
});
