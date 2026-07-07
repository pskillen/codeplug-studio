import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { serialiseChirpCsv } from './serialise.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('chirp/serialise', () => {
  it('serialises flat memory order with location indices', () => {
    const ch1 = {
      ...newChannel(projectId, 'First'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      modeProfiles: [
        { mode: 'fm' as const, rxTone: 'none' as const, txTone: 'none' as const, squelch: null, bandwidthKHz: 12.5 },
      ],
    };
    const ch2 = {
      ...newChannel(projectId, 'Second'),
      id: 'ch-2',
      rxFrequency: 433_500_000,
      txFrequency: 433_500_000,
      modeProfiles: [
        { mode: 'fm' as const, rxTone: 'none' as const, txTone: 'none' as const, squelch: null, bandwidthKHz: 12.5 },
      ],
    };
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'chirp',
      profileId: 'chirp-uv5r',
      buildName: 'Test',
      channels: [
        { entity: ch1, wireName: 'First' },
        { entity: ch2, wireName: 'Second' },
      ],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      flatMemory: { kind: 'flatMemory', channelIds: ['ch-2', 'ch-1'], scanFlags: {} },
    };

    const { csv, warnings } = serialiseChirpCsv(assembled);
    expect(warnings).toEqual([]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]?.startsWith('1,Second,')).toBe(true);
    expect(lines[2]?.startsWith('2,First,')).toBe(true);
  });

  it('skips digital-only channels with warning', () => {
    const dmr = {
      ...newChannel(projectId, 'DMR'),
      id: 'ch-dmr',
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'chirp',
      profileId: 'chirp-uv5r',
      buildName: 'Test',
      channels: [{ entity: dmr, wireName: 'DMR' }],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      flatMemory: { kind: 'flatMemory', channelIds: ['ch-dmr'], scanFlags: {} },
    };

    const { csv, warnings } = serialiseChirpCsv(assembled);
    expect(warnings.some((w) => w.includes('Skipped 1 non-analogue'))).toBe(true);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });
});
