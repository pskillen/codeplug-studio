import { describe, expect, it } from 'vitest';
import { newChannel, newZone } from '@core/domain/factories.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { buildDm32uvChannelNumberMap, singletonChannelNumbersById } from './exportContext.ts';
import { NEONPLUG_DM32UV_PROFILE } from './profiles.ts';
import { serialiseNeonplugCodeplug } from './serialise.ts';
import {
  deriveNeonplugZoneDerivedScanLists,
  ensureNeonplugDm32uvScanListsFloor,
  NEONPLUG_DM32UV_EMPTY_SCAN_LIST_NAME,
} from './zoneDerivedScanLists.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function fmChannel(id: string, name: string): Channel {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    modeProfiles: [
      {
        mode: 'fm',
        rxTone: 'none',
        txTone: 'none',
        squelch: null,
        bandwidthKHz: 12.5,
      },
    ],
  };
}

describe('neonplug/zoneDerivedScanLists', () => {
  it('derives scan lists from zoneGrouping.exportScanList and sets scanListId', () => {
    const ch1 = fmChannel('ch-1', 'Alpha');
    const ch2 = fmChannel('ch-2', 'Bravo');
    const zone: Zone = {
      ...newZone(projectId, 'Local'),
      id: 'zone-1',
      members: [
        { kind: 'channel', channelId: 'ch-1' },
        { kind: 'channel', channelId: 'ch-2' },
      ],
    };

    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: [
        { entity: ch1, wireName: 'Alpha' },
        { entity: ch2, wireName: 'Bravo' },
      ],
      zones: [
        {
          zoneId: 'zone-1',
          wireName: 'Local',
          memberChannelIds: ['ch-1', 'ch-2'],
        },
      ],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      library: {
        channels: [ch1, ch2],
        zones: [zone],
        talkGroups: [],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
        scanLists: [],
      },
      zoneGrouping: {
        kind: 'zoneGrouping',
        zones: [
          {
            id: 'zone-1',
            name: 'Local',
            channelIds: ['ch-1', 'ch-2'],
            exportScanList: true,
          },
        ],
      },
    };

    const warnings: string[] = [];
    const numbersBySource = singletonChannelNumbersById(
      buildDm32uvChannelNumberMap(assembled, 4000),
    );
    const derived = deriveNeonplugZoneDerivedScanLists(
      assembled,
      NEONPLUG_DM32UV_PROFILE,
      numbersBySource,
      { shortenNames: false },
      warnings,
    );

    expect(warnings).toEqual([]);
    expect(derived.scanLists).toEqual([
      {
        name: 'Local',
        channels: [1, 2],
        channelCount: 2,
        ctcScanMode: 0,
        scanTxMode: 0,
      },
    ]);
    expect(derived.scanListIdByChannelId.get('ch-1')).toBe(1);
    expect(derived.scanListIdByChannelId.get('ch-2')).toBe(1);

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
    });
    expect(data.scanLists).toHaveLength(1);
    expect(data.channels[0]?.scanListId).toBe(1);
    expect(data.channels[1]?.scanListId).toBe(1);
  });

  it('skips scan derivation when exportZoneDerivedScanLists is false', () => {
    const ch1 = fmChannel('ch-1', 'Alpha');
    const zone: Zone = {
      ...newZone(projectId, 'Local'),
      id: 'zone-1',
      members: [{ kind: 'channel', channelId: 'ch-1' }],
    };
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: [{ entity: ch1, wireName: 'Alpha' }],
      zones: [{ zoneId: 'zone-1', wireName: 'Local', memberChannelIds: ['ch-1'] }],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      library: {
        channels: [ch1],
        zones: [zone],
        talkGroups: [],
        digitalContacts: [],
        analogContacts: [],
        rxGroupLists: [],
        scanLists: [],
      },
      zoneGrouping: {
        kind: 'zoneGrouping',
        zones: [
          {
            id: 'zone-1',
            name: 'Local',
            channelIds: ['ch-1'],
            exportScanList: true,
          },
        ],
      },
    };

    const derived = deriveNeonplugZoneDerivedScanLists(
      assembled,
      NEONPLUG_DM32UV_PROFILE,
      singletonChannelNumbersById(buildDm32uvChannelNumberMap(assembled, 4000)),
      { exportZoneDerivedScanLists: false },
    );
    expect(derived.scanLists).toEqual([]);
  });

  it('floors empty derivation with first channel number so NeonPlug keeps the list', () => {
    expect(ensureNeonplugDm32uvScanListsFloor([], 1)).toEqual([
      {
        name: NEONPLUG_DM32UV_EMPTY_SCAN_LIST_NAME,
        channels: [1],
        channelCount: 1,
        ctcScanMode: 0,
        scanTxMode: 0,
      },
    ]);
  });

  it('floors memberless when no channel number is available (zero-channel edge)', () => {
    expect(ensureNeonplugDm32uvScanListsFloor([])).toEqual([
      {
        name: NEONPLUG_DM32UV_EMPTY_SCAN_LIST_NAME,
        channels: [],
        channelCount: 0,
        ctcScanMode: 0,
        scanTxMode: 0,
      },
    ]);
  });

  it('leaves non-empty derivation unchanged when flooring', () => {
    const existing = [
      {
        name: 'Local',
        channels: [1, 2],
        channelCount: 2,
        ctcScanMode: 0,
        scanTxMode: 0,
      },
    ];
    expect(ensureNeonplugDm32uvScanListsFloor(existing, 1)).toEqual(existing);
  });

  it('serialise floors empty scanLists with first channel; channels stay unbound', () => {
    const ch1 = fmChannel('ch-1', 'Alpha');
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: [{ entity: ch1, wireName: 'Alpha' }],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
    });

    expect(data.scanLists).toHaveLength(1);
    expect(data.scanLists[0]).toEqual({
      name: NEONPLUG_DM32UV_EMPTY_SCAN_LIST_NAME,
      channels: [1],
      channelCount: 1,
      ctcScanMode: 0,
      scanTxMode: 0,
    });
    expect(data.channels.every((ch) => ch.scanListId === 0)).toBe(true);
  });
});
