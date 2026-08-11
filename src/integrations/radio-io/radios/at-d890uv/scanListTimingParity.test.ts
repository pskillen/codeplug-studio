import { describe, expect, it } from 'vitest';
import { resolveAtD890ScanListTiming } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
import { encodeAtD890ScanListRecord } from './scanListCodec.ts';

function readU16Le(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

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
    expect(readU16Le(record, 0x6)).toBe(resolved.deciseconds.lookBackA);
    expect(readU16Le(record, 0x8)).toBe(resolved.deciseconds.lookBackB);
    expect(readU16Le(record, 0xa)).toBe(resolved.deciseconds.dropoutDelay);
    expect(readU16Le(record, 0xc)).toBe(resolved.deciseconds.dwellTime);
  });
});
