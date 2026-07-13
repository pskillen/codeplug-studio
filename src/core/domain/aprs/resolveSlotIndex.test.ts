import { describe, expect, it } from 'vitest';
import { newChannel } from '../factories.ts';
import { resolveAprsSlotIndex } from './resolveSlotIndex.ts';

describe('resolveAprsSlotIndex', () => {
  const ch1 = { ...newChannel('p1', 'Ch1'), id: 'ch-1' };
  const ch2 = { ...newChannel('p1', 'Ch2'), id: 'ch-2' };
  const assembled = [ch1, ch2];

  it('returns 1-based index when report ref matches slot channelRef', () => {
    const index = resolveAprsSlotIndex(
      { kind: 'channel', id: 'ch-2' },
      [
        {
          channelRef: { kind: 'channel', id: 'ch-1' },
          timeslot: 1,
          targetDmrId: 1,
          callType: 'group',
        },
        {
          channelRef: { kind: 'channel', id: 'ch-2' },
          timeslot: 2,
          targetDmrId: 2,
          callType: 'group',
        },
      ],
      assembled,
    );
    expect(index).toBe(2);
  });

  it('returns null when ref does not match any slot', () => {
    const index = resolveAprsSlotIndex(
      { kind: 'channel', id: 'ch-missing' },
      [
        {
          channelRef: { kind: 'channel', id: 'ch-1' },
          timeslot: 1,
          targetDmrId: 1,
          callType: 'group',
        },
      ],
      assembled,
    );
    expect(index).toBeNull();
  });
});
