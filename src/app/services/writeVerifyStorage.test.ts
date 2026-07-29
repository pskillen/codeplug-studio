import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  clearWriteVerifyPending,
  loadWriteVerifyPending,
  saveWriteVerifyPending,
  serializeWriteVerifyPending,
} from './writeVerifyStorage.ts';

describe('writeVerifyStorage', () => {
  beforeEach(() => {
    clearWriteVerifyPending();
  });

  it('round-trips pending payload with profileId', () => {
    const payload = serializeWriteVerifyPending('build-1', 'egress-1', 'radio-io-at-d890uv', {
      staging: {
        capturedAt: '2026-07-29T00:00:00.000Z',
        chunks: [{ address: 0x1000, data: Uint8Array.from([1, 2, 3]) }],
      },
      kept: { entries: [{ id: 'alarm', data: [0xff] }] },
    });
    expect(saveWriteVerifyPending(payload)).toBe(true);
    const loaded = loadWriteVerifyPending('build-1', 'egress-1', 'radio-io-at-d890uv');
    expect(loaded).toEqual(payload);
  });

  it('rejects profileId mismatch', () => {
    const payload = serializeWriteVerifyPending('build-1', 'egress-1', 'radio-io-at-d890uv', {
      staging: { capturedAt: 't', chunks: [] },
    });
    saveWriteVerifyPending(payload);
    expect(loadWriteVerifyPending('build-1', 'egress-1', 'radio-io-dm32uv')).toBeNull();
  });

  it('rejects buildId or egressId mismatch', () => {
    const payload = serializeWriteVerifyPending('build-1', 'egress-1', 'radio-io-at-d890uv', {
      staging: { capturedAt: 't', chunks: [] },
    });
    saveWriteVerifyPending(payload);
    expect(loadWriteVerifyPending('build-2', 'egress-1', 'radio-io-at-d890uv')).toBeNull();
    expect(loadWriteVerifyPending('build-1', 'egress-2', 'radio-io-at-d890uv')).toBeNull();
  });
});
