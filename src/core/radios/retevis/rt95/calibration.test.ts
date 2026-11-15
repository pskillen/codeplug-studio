import { describe, expect, it } from 'vitest';
import { decodeRt95Calibration, RT95_CALIBRATION_LENGTH } from './calibration.ts';

describe('RT95 calibration decoder', () => {
  it('preserves boundaries, references, byte values and little-endian words', () => {
    const bytes = new Uint8Array(RT95_CALIBRATION_LENGTH);
    bytes[0x486] = 0x34;
    bytes[0x487] = 0x12;
    bytes[0x1c0] = 0xff;
    bytes[0x1c0 + 19] = 2;
    bytes[0x481] = 3;
    const { fields } = decodeRt95Calibration(bytes);
    expect(fields.find((f) => f.address === 0x3f86)?.value).toBe(0x1234);
    expect(fields.find((f) => f.address === 0x3cc0)).toMatchObject({
      width: 39,
      referenceIndex: 19,
      powerCode: 0,
    });
    expect(fields.find((f) => f.address === 0x3e80)).toMatchObject({
      width: 91,
      referenceIndex: 45,
      powerCode: 2,
    });
    expect(fields.find((f) => f.address === 0x3cc0)?.raw[0]).toBe(255);
    expect(fields.find((f) => f.address === 0x3cc0)?.corrections?.[0]).toBe(256);
    expect(fields.find((f) => f.address === 0x3f80)?.value).toBe(0);
  });
  it('does not decode missing or half-captured values', () => {
    const fields = decodeRt95Calibration(new Uint8Array(0x487)).fields;
    expect(fields.find((f) => f.address === 0x3f86)?.availability).toBe('partial');
    expect(fields.find((f) => f.address === 0x3f86)?.value).toBeUndefined();
    expect(fields.find((f) => f.address === 0x3fa0)?.availability).toBe('not-captured');
    expect(decodeRt95Calibration().fields[0]?.availability).toBe('not-captured');
    expect(
      decodeRt95Calibration(new Uint8Array(0x1c2)).fields.find((f) => f.address === 0x3cc0)
        ?.availability,
    ).toBe('partial');
  });
});
