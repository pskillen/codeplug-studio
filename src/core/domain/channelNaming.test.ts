import { describe, expect, it } from 'vitest';
import { composeChannelWireName, defaultChannelWireName } from './channelNaming.ts';
import type { Channel } from '@core/models/library.ts';

function channel(partial: Partial<Channel> & Pick<Channel, 'name'>): Channel {
  return {
    id: 'ch-1',
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    callsign: '',
    rxFrequency: null,
    txFrequency: null,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanSkip: false,
    forbidTransmit: false,
    comment: '',
    modeProfiles: [],
    ...partial,
  };
}

describe('defaultChannelWireName', () => {
  it('joins callsign and channel name by default', () => {
    const row = channel({ callsign: 'GB7GL', name: 'Glasgow' });
    expect(defaultChannelWireName(row)).toBe('GB7GL Glasgow');
    expect(
      composeChannelWireName({
        callsign: 'GB7GL',
        name: 'Glasgow',
        exportNameMode: 'callsign_name',
      }),
    ).toBe('GB7GL Glasgow');
  });

  it('falls back to name or callsign when one is missing', () => {
    expect(defaultChannelWireName(channel({ callsign: 'GB3DA', name: '' }))).toBe('GB3DA');
    expect(defaultChannelWireName(channel({ callsign: '', name: 'Scotland' }))).toBe('Scotland');
  });
});
