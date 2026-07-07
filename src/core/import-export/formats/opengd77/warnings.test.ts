import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { collectOpenGd77ExportWarnings } from './warnings.ts';

function stubChannel(name: string): Channel {
  return {
    id: 'ch-1',
    projectId: 'p1',
    name,
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    callsign: '',
    rxFrequency: null,
    txFrequency: null,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanInclusion: 'default',
    forbidTransmit: false,
    comment: '',
    modeProfiles: [],
  };
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
});
