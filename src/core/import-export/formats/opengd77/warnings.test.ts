import { describe, expect, it } from 'vitest';
import { newChannel, newRxGroupList } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { collectOpenGd77ExportWarnings } from './warnings.ts';

function stubChannel(name: string): Channel {
  return { ...newChannel('p1', name), id: 'ch-1' };
}

function minimalAssembled(overrides: Partial<AssembledBuild> = {}): AssembledBuild {
  return {
    buildId: 'build-1',
    formatId: 'opengd77',
    profileId: 'opengd77-1701',
    buildName: 'Test',
    channels: [],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
    ...overrides,
  };
}

describe('collectOpenGd77ExportWarnings', () => {
  it('warns when channel wire name exceeds profile name limit', () => {
    const assembled = minimalAssembled({
      channels: [
        {
          wireName: 'ThisNameIsWayTooLong',
          entity: stubChannel('ThisNameIsWayTooLong'),
        },
      ],
    });

    const warnings = collectOpenGd77ExportWarnings(assembled);
    expect(warnings.some((w) => w.includes('ThisNameIsWayTooLong'))).toBe(true);
    expect(warnings.some((w) => w.includes('exported as'))).toBe(true);
    expect(warnings.some((w) => w.includes('16 characters'))).toBe(true);
  });

  it('returns no warnings for fixture-sized projection', () => {
    const assembled = minimalAssembled({
      channels: [
        {
          wireName: 'GB3DA Demo',
          entity: stubChannel('GB3DA Demo'),
        },
      ],
    });

    expect(collectOpenGd77ExportWarnings(assembled)).toEqual([]);
  });

  it('warns when zone count exceeds profile maxZones', () => {
    const zones = Array.from({ length: 69 }, (_, i) => ({
      zoneId: `zone-${i}`,
      wireName: `Zone ${i}`,
      memberChannelIds: [] as string[],
    }));
    const warnings = collectOpenGd77ExportWarnings(minimalAssembled({ zones }));
    expect(warnings.some((w) => w.includes('69 zones') && w.includes('68'))).toBe(true);
  });

  it('warns when RX group list count exceeds profile maxRxGroupLists', () => {
    const rxGroupLists = Array.from({ length: 77 }, (_, i) => ({
      entity: { ...newRxGroupList('p1', `RGL ${i}`), id: `rgl-${i}`, members: [] },
      wireName: `RGL ${i}`,
    }));
    const warnings = collectOpenGd77ExportWarnings(minimalAssembled({ rxGroupLists }));
    expect(warnings.some((w) => w.includes('77 RX group lists') && w.includes('76'))).toBe(true);
  });
});
