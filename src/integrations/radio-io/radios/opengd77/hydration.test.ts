import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import {
  encodeOpenGd77WriteImageFromPrior,
  OPENGD77_EMPTY_WRITE_PRIOR_MESSAGE,
} from './hydration.ts';
import {
  OPENGD77_CHANNEL_RECORD_SIZE,
  OPENUV380_IMAGE_SIZE,
  OPENUV380_OFFSET,
} from './constants.ts';
import { createOpenUv380Image, readAbs, writeAbs } from './memory.ts';
import { channelRecordAbs, decodeChannelRecord } from './channelCodec.ts';

describe('encodeOpenGd77WriteImageFromPrior', () => {
  it('refuses a missing or undersized prior instead of a blank 0xff map', () => {
    expect(() => encodeOpenGd77WriteImageFromPrior(null, [])).toThrow(
      OPENGD77_EMPTY_WRITE_PRIOR_MESSAGE,
    );
    expect(() => encodeOpenGd77WriteImageFromPrior(undefined, [])).toThrow(
      OPENGD77_EMPTY_WRITE_PRIOR_MESSAGE,
    );
    expect(() => encodeOpenGd77WriteImageFromPrior(createMemoryMap(16), [])).toThrow(
      OPENGD77_EMPTY_WRITE_PRIOR_MESSAGE,
    );
  });

  it('overlays channels onto a live-sized prior and leaves settings bytes', () => {
    const prior = createOpenUv380Image();
    writeAbs(prior, OPENUV380_OFFSET.settings, new Uint8Array([0xa1]));
    const image = encodeOpenGd77WriteImageFromPrior(prior, [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'CH1',
        rxHz: 145_500_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'NFM',
        mode: 'analog',
      },
    ]);
    expect(image.size).toBe(OPENUV380_IMAGE_SIZE);
    expect(readAbs(image, OPENUV380_OFFSET.settings, 1)[0]).toBe(0xa1);
    const rec = decodeChannelRecord(
      readAbs(image, channelRecordAbs(1), OPENGD77_CHANNEL_RECORD_SIZE),
      1,
    );
    expect(rec.wireName).toBe('CH1');
  });
});
