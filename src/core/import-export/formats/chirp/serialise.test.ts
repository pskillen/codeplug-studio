import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { serialiseChirpCsv } from './serialise.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('chirp/serialise', () => {
  it('serialises memory slot order with location indices', () => {
    const ch1: Channel = {
      ...newChannel(projectId, 'First'),
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
    const ch2: Channel = {
      ...newChannel(projectId, 'Second'),
      id: 'ch-2',
      rxFrequency: 433_500_000,
      txFrequency: 433_500_000,
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
      scanLists: [],
      channelMemorySlots: [
        { slot: 1, channelId: 'ch-2' },
        { slot: 2, channelId: 'ch-1' },
      ],
    };

    const { csv, warnings } = serialiseChirpCsv(assembled);
    expect(warnings).toEqual([]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]?.startsWith('1,Second,')).toBe(true);
    expect(lines[2]?.startsWith('2,First,')).toBe(true);
  });

  it('emits blank rows for empty memory slots', () => {
    const ch1: Channel = {
      ...newChannel(projectId, 'First'),
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
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'chirp',
      profileId: 'chirp-uv5r',
      buildName: 'Test',
      channels: [{ entity: ch1, wireName: 'First' }],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelMemorySlots: [
        { slot: 1, channelId: 'ch-1' },
        { slot: 2, channelId: null },
        { slot: 3, channelId: null },
      ],
    };

    const { csv } = serialiseChirpCsv(assembled);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]?.startsWith('1,First,')).toBe(true);
    expect(lines[2]?.startsWith('2,')).toBe(true);
    expect(lines[2]?.split(',')[1]).toBe('');
    expect(lines[3]?.startsWith('3,')).toBe(true);
  });

  it('skips digital-only channels with warning', () => {
    const dmr: Channel = {
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
      scanLists: [],
      channelMemorySlots: [{ slot: 1, channelId: 'ch-dmr' }],
    };

    const { csv, warnings } = serialiseChirpCsv(assembled);
    expect(warnings.some((w) => w.includes('Skipped 1 non-analogue'))).toBe(true);
    expect(csv.trim().split('\n')).toHaveLength(1);
  });

  it('shortens channel names to 6 chars for chirp-rt95', () => {
    const ch1: Channel = {
      ...newChannel(projectId, 'Very Long Channel Name'),
      id: 'ch-1',
      callsign: '',
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
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'chirp',
      profileId: 'chirp-rt95',
      buildName: 'Test',
      channels: [{ entity: ch1, wireName: 'Very Long Channel Name' }],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelMemorySlots: [{ slot: 1, channelId: 'ch-1' }],
    };

    const { csv } = serialiseChirpCsv(assembled, { profileId: 'chirp-rt95', shortenNames: true });
    const nameCell = csv.trim().split('\n')[1]?.split(',')[1] ?? '';
    expect(nameCell.length).toBeLessThanOrEqual(6);
    expect(nameCell.length).toBeGreaterThan(0);
  });
});
