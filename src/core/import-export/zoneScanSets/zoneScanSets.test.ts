import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { initialRevision } from '@core/models/revision.ts';
import { buildZoneBehaviourContext } from '@core/import-export/zoneBehaviourDefaults/index.ts';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  ZONE_SCAN_SET_MIN_CHANNELS,
  checkZoneScanSets,
  checkZoneOrderRoom,
  resolveZoneScanSets,
  zoneScanSetChannelNumbers,
  zoneScanSetCounts,
} from './index.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const Z1 = '44444444-4444-4444-8444-444444444444';
const Z2 = '55555555-5555-4555-8555-555555555555';

function zone(id: string, members: Zone['members'], name = 'Test'): Zone {
  return {
    id,
    projectId: PROJECT_ID,
    revision: initialRevision(),
    updatedAt: '2026-11-15T10:00:00.000Z',
    name,
    members,
    comment: '',
  };
}

describe('resolveZoneScanSets', () => {
  const z1 = zone(
    Z1,
    [
      { kind: 'channel', channelId: A },
      { kind: 'channel', channelId: B, includeInScanList: 'skip' },
      { kind: 'channel', channelId: C },
      { kind: 'channel', channelId: OUT },
    ],
    'Local',
  );
  const z2 = zone(Z2, [{ kind: 'channel', channelId: B }], 'Other');
  const library = { zones: [z1, z2] };

  it('includes every member by default and honours member skips; one set per zone', () => {
    const sets = resolveZoneScanSets(
      {
        zones: [
          // OUT is not in the build, and the assembled member order is the build's (C before A).
          { zoneId: Z1, wireName: 'Local', memberChannelIds: [C, A, B] },
          { zoneId: Z2, wireName: 'Other', memberChannelIds: [B] },
        ],
      },
      library,
    );
    expect(sets).toEqual([
      { zoneId: Z1, wireName: 'Local', scanChannelIds: [C, A] },
      // B is skipped in Local only.
      { zoneId: Z2, wireName: 'Other', scanChannelIds: [B] },
    ]);
  });

  it("applies this build's per-zone choice and the build default", () => {
    const assembled = {
      zones: [{ zoneId: Z1, wireName: 'Local', memberChannelIds: [A, B, C] }],
      zoneGrouping: {
        kind: 'zoneGrouping' as const,
        zones: [
          {
            id: Z1,
            name: 'Local',
            channelIds: [],
            scanMemberInclusion: { [C]: 'skip' as const, [B]: 'include' as const },
          },
        ],
      },
    };
    expect(resolveZoneScanSets(assembled, library)[0]!.scanChannelIds).toEqual([A, B]);

    const allSkipped = buildZoneBehaviourContext(undefined, {
      defaultIncludeInZoneDerivedScanList: false,
    });
    // The build default wins over the member; the per-zone choice wins over both.
    expect(resolveZoneScanSets(assembled, library, allSkipped)[0]!.scanChannelIds).toEqual([B]);
  });

  it('gives an empty set to a zone missing from the library', () => {
    expect(
      resolveZoneScanSets(
        { zones: [{ zoneId: 'gone', wireName: 'X', memberChannelIds: [A] }] },
        library,
      ),
    ).toEqual([{ zoneId: 'gone', wireName: 'X', scanChannelIds: [] }]);
  });
});

describe('zoneScanSetChannelNumbers', () => {
  it("keeps the zone's channel numbers that belong to a channel in the set", () => {
    const numbers = new Map([
      [A, [3]],
      [B, [1]],
      [C, [7]],
    ]);
    expect(zoneScanSetChannelNumbers([C, A], numbers, [1, 3, 7])).toEqual([3, 7]);
    // A number dropped from the zone (beyond the radio) is not in the set either.
    expect(zoneScanSetChannelNumbers([C, A], numbers, [1, 3])).toEqual([3]);
  });
});

describe('zoneScanSetCounts', () => {
  const assembled = {
    // OUT is not in the build, so it is not an assembled member and is never counted.
    zones: [{ zoneId: Z1, wireName: 'Local', memberChannelIds: [A, B, C] }],
  };
  const sets = [{ zoneId: Z1, wireName: 'Local', scanChannelIds: [A, C] }];

  it('counts the written members and those in the scan set', () => {
    expect(zoneScanSetCounts(assembled, sets).get(Z1)).toEqual({ included: 2, total: 3 });
  });

  it('leaves out members over the zone member cap', () => {
    expect(zoneScanSetCounts(assembled, sets, 2).get(Z1)).toEqual({ included: 1, total: 2 });
  });
});

describe('checkZoneScanSets', () => {
  it('warns for each zone with fewer than two channels in its set, and still writes', () => {
    const warnings: ExportWarning[] = [];
    const result = checkZoneScanSets(
      [
        { zoneName: 'Empty', scanChannelNumbers: [] },
        { zoneName: 'One', scanChannelNumbers: [4, 4] },
        { zoneName: 'Two', scanChannelNumbers: [4, 5] },
      ],
      {},
      warnings,
    );
    expect(ZONE_SCAN_SET_MIN_CHANNELS).toBe(2);
    expect(result).toEqual({ writeScanSets: true });
    expect(warnings).toEqual([
      { kind: 'zone_scan_set', severity: 'problem', issue: 'too-few', zoneName: 'Empty', count: 0 },
      { kind: 'zone_scan_set', severity: 'problem', issue: 'too-few', zoneName: 'One', count: 1 },
    ]);
    expect(formatExportWarning(warnings[1]!)).toMatch(
      /Zone "One" has 1 channel set to Scan in this zone, so this zone won't scan on the radio/,
    );
  });

  it('stops at firmware too old: scan sets are not written and no per-zone warnings', () => {
    const warnings: ExportWarning[] = [];
    const result = checkZoneScanSets(
      [{ zoneName: 'One', scanChannelNumbers: [1] }],
      {
        firmwareTooOld: () => ({ reason: 'the radio reports firmware 1.0.0' }),
        roomExceeded: () => ({ limit: 1, needed: 2, unit: 'sets', consequence: 'x' }),
      },
      warnings,
    );
    expect(result).toEqual({ writeScanSets: false });
    expect(warnings).toHaveLength(1);
    expect(formatExportWarning(warnings[0]!)).toBe(
      "The radio's firmware is too old for zone scan sets (the radio reports firmware 1.0.0). They were not written, and its zones scan as before.",
    );
  });

  it("passes the sets to the radio's room check and warns with its figures", () => {
    const warnings: ExportWarning[] = [];
    const seen: number[] = [];
    checkZoneScanSets(
      [
        { zoneName: 'A', scanChannelNumbers: [1, 2] },
        { zoneName: 'B', scanChannelNumbers: [3, 4] },
      ],
      {
        firmwareTooOld: () => undefined,
        roomExceeded: (sets) => {
          seen.push(sets.length);
          return {
            limit: 1,
            needed: 2,
            unit: 'zone scan sets',
            consequence: 'Zones after the first scan as before.',
          };
        },
      },
      warnings,
    );
    expect(seen).toEqual([2]);
    expect(warnings.map(formatExportWarning)).toEqual([
      'The zone scan sets need 2 zone scan sets, but the radio holds 1. Zones after the first scan as before.',
    ]);
  });
});

describe('zone order capacity', () => {
  it('warns for the zones chosen by the radio without refusing the others', () => {
    const warnings: ExportWarning[] = [];
    checkZoneOrderRoom(
      [
        { zoneName: 'First', channelNumbers: [2, 1] },
        { zoneName: 'Later', channelNumbers: [4, 3] },
      ],
      () => [0],
      warnings,
    );
    expect(warnings).toEqual([{ kind: 'zone_order', severity: 'problem', zoneName: 'First' }]);
    expect(formatExportWarning(warnings[0]!)).toContain('channel-number order');
  });
});
