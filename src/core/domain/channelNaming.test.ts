import { describe, expect, it } from 'vitest';
import { newChannel } from './factories.ts';
import { composeChannelWireName, defaultChannelWireName } from './channelNaming.ts';
import type { Channel } from '@core/models/library.ts';

function channel(partial: Partial<Channel> & Pick<Channel, 'name'>): Channel {
  return { ...newChannel('p1', partial.name), ...partial };
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
