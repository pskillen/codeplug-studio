import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { expandChannelWireRows } from './multiMode.ts';

function multiModeChannel(): Channel {
  return {
    ...newChannel('p1', 'Glasgow', 'GB7GL'),
    rxFrequency: 430000000,
    txFrequency: 430000000,
    modeProfiles: [
      { mode: 'fm', squelch: 50, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 2,
        dmrId: 123,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
}

describe('multiMode expansion', () => {
  it('expands multi-mode channel to two wire rows when expandModes is true', () => {
    const rows = expandChannelWireRows(multiModeChannel(), 'GB7GL Glasgow', true);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.wireName).toBe('GB7GL Glasgow-F');
    expect(rows[1]?.wireName).toBe('GB7GL Glasgow-D');
  });

  it('keeps one row when expandModes is false', () => {
    const rows = expandChannelWireRows(multiModeChannel(), 'GB7GL Glasgow', false);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.wireName).toBe('GB7GL Glasgow');
  });
});
