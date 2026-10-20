import { describe, expect, it } from 'vitest';
import { resolveAtD890ScanListTiming } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { AT_D890_LIMITS } from './constants.ts';
import { scanListAddress } from './memory.ts';
import { encodeAtD890ScanListRecord, encodeScanListsIntoAtD890Image } from './scanListCodec.ts';

describe('AT-D890UV scan-list timing CSV/serial parity', () => {
  it('matches deciseconds derived from the same export settings', () => {
    const settings = {
      scanListLookBackASeconds: 2.5,
      scanListLookBackBSeconds: 4,
      scanListDropoutDelaySeconds: 1.5,
      scanListDwellTimeSeconds: 3.1,
    };
    const resolved = resolveAtD890ScanListTiming(settings);
    const record = encodeAtD890ScanListRecord(
      { wireName: 'Scan', listIndex: 1, channelNumbers: [1] },
      resolved.deciseconds,
    );
    expect(resolved.csv).toEqual({
      lookBackA: '2.5',
      lookBackB: '4.0',
      dropoutDelay: '1.5',
      dwellTime: '3.1',
    });
    expect(record[0x6]).toBe(resolved.deciseconds.lookBackA);
    expect(record[0x8]).toBe(resolved.deciseconds.lookBackB);
    expect(record[0xa]).toBe(resolved.deciseconds.dropoutDelay);
    expect(record[0xc]).toBe(resolved.deciseconds.dwellTime);

    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const prior = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_STRIDE);
    prior[0x00] = 0x11;
    prior[0x07] = 0x22;
    prior[0x09] = 0x33;
    prior[0x0b] = 0x44;
    prior[0x0d] = 0x55;
    prior[0xf9] = 0x77;
    prior[0xfa] = 0x88;
    prior[0xfb] = 0x99;
    image.set(scanListAddress(0), prior);
    encodeScanListsIntoAtD890Image(
      image,
      [{ wireName: 'Scan', listIndex: 1, channelNumbers: [1] }],
      resolved.deciseconds,
    );
    const out = image.get(scanListAddress(0), AT_D890_LIMITS.SCAN_LIST_STRIDE);
    expect(out[0x06]).toBe(resolved.deciseconds.lookBackA);
    expect(out[0x08]).toBe(resolved.deciseconds.lookBackB);
    expect(out[0x0a]).toBe(resolved.deciseconds.dropoutDelay);
    expect(out[0x0c]).toBe(resolved.deciseconds.dwellTime);
    expect(out[0x00]).toBe(prior[0x00]);
    expect(out[0x07]).toBe(prior[0x07]);
    expect(out[0x09]).toBe(prior[0x09]);
    expect(out[0x0b]).toBe(prior[0x0b]);
    expect(out[0x0d]).toBe(prior[0x0d]);
    expect(out[0xf8]).toBe(0x01);
    expect(out[0xf9]).toBe(prior[0xf9]);
    expect(out[0xfa]).toBe(prior[0xfa]);
    expect(out[0xfb]).toBe(prior[0xfb]);
  });
});
