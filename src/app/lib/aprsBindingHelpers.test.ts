import { describe, expect, it } from 'vitest';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { Channel } from '@core/models/library.ts';
import { formatAprsAssignmentSummary } from './aprsBindingHelpers.ts';

const channelA: Channel = {
  id: 'ch-a',
  projectId: 'p1',
  revision: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'GB7AC',
  callsign: 'GB7AC',
  rxFrequency: null,
  txFrequency: null,
  location: null,
  useLocation: false,
  maidenheadLocator: null,
  power: null,
  scanInclusion: 'default',
  forbidTransmit: false,
  comment: '',
  primaryMode: null,
  modeProfiles: [],
};

const channelB: Channel = {
  ...channelA,
  id: 'ch-b',
  name: 'Scotland TG',
  callsign: 'GB7GL',
};

const slots: AprsChannelSlot[] = [
  {
    channelRef: { kind: 'channel', id: 'ch-a' },
    timeslot: 1,
    targetDmrId: 1,
    callType: 'group',
  },
  {
    channelRef: null,
    timeslot: 2,
    targetDmrId: 2,
    callType: 'group',
  },
];

describe('formatAprsAssignmentSummary', () => {
  it('returns em dash when binding is off or missing', () => {
    expect(formatAprsAssignmentSummary(undefined, slots, [channelA])).toBe('—');
    expect(
      formatAprsAssignmentSummary(
        {
          receiveEnabled: false,
          reportType: 'off',
          digitalPttMode: 'off',
          reportSlotIndex: null,
        },
        slots,
        [channelA],
      ),
    ).toBe('—');
  });

  it('returns Digital when report type is digital without a slot', () => {
    expect(
      formatAprsAssignmentSummary(
        {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'on',
          reportSlotIndex: null,
        },
        slots,
        [channelA],
      ),
    ).toBe('Digital');
  });

  it('formats slot index with resolved channel label', () => {
    expect(
      formatAprsAssignmentSummary(
        {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'on',
          reportSlotIndex: 1,
        },
        slots,
        [channelA, channelB],
      ),
    ).toBe('1 · GB7AC — GB7AC');
  });

  it('uses current channel label when slot channelRef is null', () => {
    expect(
      formatAprsAssignmentSummary(
        {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'on',
          reportSlotIndex: 2,
        },
        slots,
        [channelA],
      ),
    ).toBe('2 · Current channel');
  });
});
