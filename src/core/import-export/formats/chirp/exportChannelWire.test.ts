import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import { buildChannelBehaviourContext } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import { DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS } from '@core/models/channelBehaviourDefaults.ts';
import { channelToChirpRow, type ChirpChannelWireOptions } from './exportChannelWire.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function testWireOptions(): ChirpChannelWireOptions {
  return {
    reserved: new Set<string>(),
    maxNameLength: 128,
    shortenNames: false,
  };
}

function assembledChannel(patch: Partial<ReturnType<typeof newChannel>>): AssembledChannel {
  const entity: Channel = {
    ...newChannel(projectId, 'Test'),
    modeProfiles: [
      {
        mode: 'fm' as const,
        rxTone: 'none' as const,
        txTone: 'none' as const,
        squelch: null,
        bandwidthKHz: 12.5,
      },
    ],
    ...patch,
  };
  return { entity, wireName: entity.name };
}

describe('chirp/exportChannelWire', () => {
  it('exports simplex when rx equals tx and forbidTransmit is false', () => {
    const row = channelToChirpRow(
      assembledChannel({
        name: 'Simplex',
        rxFrequency: 145_500_000,
        txFrequency: 145_500_000,
        forbidTransmit: 'default',
      }),
      1,
      'chirp-uv5r',
      testWireOptions(),
      { formatDefault: 'skip' },
    );
    expect(row[3]).toBe('');
    expect(row[4]).toBe('0.000000');
  });

  it('exports off duplex when forbidTransmit is true', () => {
    const row = channelToChirpRow(
      assembledChannel({
        name: 'Listen only',
        rxFrequency: 145_500_000,
        txFrequency: 145_500_000,
        forbidTransmit: 'forbid',
      }),
      2,
      'chirp-uv5r',
      testWireOptions(),
      { formatDefault: 'skip' },
    );
    expect(row[3]).toBe('off');
    expect(row[4]).toBe('0.000000');
  });

  it('exports off duplex when library default forbids transmit', () => {
    const row = channelToChirpRow(
      assembledChannel({
        name: 'Library listen only',
        rxFrequency: 145_500_000,
        txFrequency: 145_500_000,
        forbidTransmit: 'default',
      }),
      2,
      'chirp-uv5r',
      testWireOptions(),
      { formatDefault: 'skip' },
      {
        channelBehaviourContext: buildChannelBehaviourContext({
          ...DEFAULT_CHANNEL_BEHAVIOUR_DEFAULTS,
          forbidTransmit: true,
        }),
      },
    );
    expect(row[3]).toBe('off');
    expect(row[4]).toBe('0.000000');
  });

  it('uses channel abbreviation for export wire name when enabled', () => {
    const row = channelToChirpRow(
      assembledChannel({
        name: 'Largs Scotland West',
        abbreviation: 'Largs',
        callsign: 'GB7AC',
        rxFrequency: 145_500_000,
        txFrequency: 145_500_000,
        forbidTransmit: 'default',
      }),
      3,
      'chirp-uv5r',
      { ...testWireOptions(), useChannelAbbreviation: true },
      { formatDefault: 'skip' },
      { useChannelAbbreviation: true },
    );
    expect(row[1]).toBe('GB7AC Largs');
  });
});
