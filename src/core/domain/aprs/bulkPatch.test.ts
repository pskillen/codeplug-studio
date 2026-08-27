import { describe, expect, it } from 'vitest';
import { CHANNEL_APRS_OFF } from './defaults.ts';
import { applyAprsChannelBulkPatch } from './bulkPatch.ts';

describe('applyAprsChannelBulkPatch', () => {
  it('leaves unspecified fields on the current binding', () => {
    const current = { ...CHANNEL_APRS_OFF, receiveEnabled: true, reportType: 'digital' as const };
    expect(
      applyAprsChannelBulkPatch(current, { patchDigitalPttMode: true, digitalPttMode: 'on' }),
    ).toEqual({
      ...current,
      digitalPttMode: 'on',
    });
  });

  it('clears the binding when requested', () => {
    expect(
      applyAprsChannelBulkPatch(
        { ...CHANNEL_APRS_OFF, reportType: 'digital' },
        { clearBinding: true },
      ),
    ).toBeUndefined();
  });
});
