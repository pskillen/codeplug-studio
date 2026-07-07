import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import type { RepeaterListing } from '@integrations/repeaters/types.ts';
import { buildRepeaterDirectoryRows } from './repeaterDirectoryRows.ts';

const baseChannel: Channel = {
  id: 'ch-1',
  projectId: 'p1',
  revision: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'Danbury',
  callsign: 'GB3DA',
  rxFrequency: 145_725_000,
  txFrequency: 145_125_000,
  comment: '',
  power: null,
  scanInclusion: 'default',
  forbidTransmit: false,
  useLocation: false,
  location: null,
  maidenheadLocator: null,
  modeProfiles: [{ mode: 'fm', rxTone: 'none', txTone: 'none', squelch: null, bandwidthKHz: null }],
};

function listing(
  overrides: Partial<RepeaterListing> & Pick<RepeaterListing, 'remoteId' | 'callsign'>,
): RepeaterListing {
  return {
    source: 'ukrepeater',
    name: 'Danbury',
    rxFrequencyHz: 145_725_000,
    txFrequencyHz: 145_125_000,
    toneHz: null,
    modes: ['fm'],
    primaryMode: 'fm',
    colourCode: null,
    locator: 'JO01GR',
    location: null,
    band: '2M',
    status: 'OPERATIONAL',
    ...overrides,
  };
}

const keyFn = (l: RepeaterListing) => `${l.source}:${l.remoteId}`;

describe('buildRepeaterDirectoryRows', () => {
  it('marks row as existing when callsign matches library channel', () => {
    const rows = buildRepeaterDirectoryRows(
      [listing({ remoteId: '1', callsign: 'GB3DA' })],
      [baseChannel],
      keyFn,
    );
    expect(rows[0]?.existing?.id).toBe('ch-1');
  });

  it('allows add when mapped name matches but callsign differs', () => {
    const rows = buildRepeaterDirectoryRows(
      [
        listing({ remoteId: '1', callsign: 'GB3DB', name: 'Danbury' }),
        listing({ remoteId: '2', callsign: 'GB3DC', name: 'Danbury' }),
      ],
      [baseChannel],
      keyFn,
    );
    expect(rows[0]?.existing).toBeNull();
    expect(rows[1]?.existing).toBeNull();
  });

  it('matches callsign case-insensitively', () => {
    const rows = buildRepeaterDirectoryRows(
      [listing({ remoteId: '1', callsign: 'gb3da' })],
      [baseChannel],
      keyFn,
    );
    expect(rows[0]?.existing?.id).toBe('ch-1');
  });
});
