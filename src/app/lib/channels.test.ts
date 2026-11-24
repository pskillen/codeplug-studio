import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import { channelSelectionName } from './channels.ts';

describe('channelSelectionName', () => {
  it('joins callsign and name for the checkbox label', () => {
    const ch = newChannel('p1', 'Glasgow', 'GB3AA');
    expect(channelSelectionName(ch)).toBe('GB3AA — Glasgow');
  });

  it('returns name alone when there is no callsign', () => {
    const ch = newChannel('p1', 'Glasgow', '');
    expect(channelSelectionName(ch)).toBe('Glasgow');
  });

  it('returns "channel" when neither callsign nor name is set', () => {
    const ch = newChannel('p1', '', '');
    expect(channelSelectionName(ch)).toBe('channel');
  });
});
