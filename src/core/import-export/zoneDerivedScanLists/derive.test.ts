import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild, newZone } from '@core/domain/factories.ts';
import { seedZoneGroupingFromLibrary } from '@core/domain/zoneGroupingLayout.ts';
import { assemble } from '@core/services/assemble.ts';
import { SCAN_COL } from '../formats/dm32/columns.ts';
import {
  DM32_EMPTY_SCAN_LIST_NAME,
  deriveZoneDerivedScanLists,
  ensureDm32ScanCsvFloor,
} from './derive.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('ensureDm32ScanCsvFloor', () => {
  it('adds one Scan.csv row with first channel member when scanRows would be empty', () => {
    const floored = ensureDm32ScanCsvFloor(
      {
        scanRows: [],
        carriers: [],
        scanListByChannelWireName: new Map(),
        carrierPrependByZoneId: new Map(),
      },
      'GB3DA',
    );
    expect(floored.scanRows).toHaveLength(1);
    expect(floored.scanRows[0]?.values[SCAN_COL.name]).toBe(DM32_EMPTY_SCAN_LIST_NAME);
    expect(floored.scanRows[0]?.values[SCAN_COL.channelMembers]).toBe('GB3DA|');
    expect(floored.scanRows[0]?.values[SCAN_COL.designedChannel]).toBe('None');
    expect(floored.carriers).toEqual([]);
  });

  it('floors memberless when no wire name is available (zero-channel edge)', () => {
    const floored = ensureDm32ScanCsvFloor({
      scanRows: [],
      carriers: [],
      scanListByChannelWireName: new Map(),
      carrierPrependByZoneId: new Map(),
    });
    expect(floored.scanRows[0]?.values[SCAN_COL.channelMembers]).toBe('');
  });

  it('leaves non-empty scanRows unchanged', () => {
    const existing = {
      scanRows: [
        {
          values: {
            [SCAN_COL.number]: '1',
            [SCAN_COL.name]: 'Local',
            [SCAN_COL.channelMembers]: 'Alpha|',
          },
        },
      ],
      carriers: [],
      scanListByChannelWireName: new Map([['Local Scan', 'Local']]),
      carrierPrependByZoneId: new Map(),
    };
    expect(ensureDm32ScanCsvFloor(existing, 'GB3DA')).toBe(existing);
  });
});

describe('deriveZoneDerivedScanLists', () => {
  it('returns empty scanRows when no zone exportScanList (floor is serialise concern)', () => {
    const channel = {
      ...newChannel(PROJECT_ID, 'Alpha'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          squelch: null,
          bandwidthKHz: 12.5,
        },
      ],
    };
    const zone = newZone(PROJECT_ID, 'Local');
    zone.members = [{ kind: 'channel', channelId: channel.id }];
    const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv', 'DM32');
    const layout = seedZoneGroupingFromLibrary({
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    });
    build.layout = { sections: [layout] };
    const library = {
      channels: [channel],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = {
      ...assemble(build, library, { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' }),
      library,
      zoneGrouping: layout,
    };

    const derived = deriveZoneDerivedScanLists(assembled, library, new Map());
    expect(derived.scanRows).toEqual([]);
    expect(derived.carriers).toEqual([]);
    expect(derived.scanListByChannelWireName.size).toBe(0);
  });
});
