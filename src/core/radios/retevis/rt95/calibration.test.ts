import { describe, expect, it } from 'vitest';
import { decodeRt95Calibration, RT95_CALIBRATION_LENGTH } from './calibration.ts';

describe('RT95 calibration decoder', () => {
  it('tiles 0x3B00-0x3FBF exactly, with every byte in one field', () => {
    const { fields } = decodeRt95Calibration(new Uint8Array(RT95_CALIBRATION_LENGTH));
    let next = 0x3b00;
    for (const f of [...fields].sort((a, b) => a.address - b.address)) {
      expect(f.address).toBe(next);
      next += f.width;
    }
    expect(next).toBe(0x3b00 + RT95_CALIBRATION_LENGTH);
    const bytes = (m: string) =>
      fields.filter((f) => f.meaning === m).reduce((n, f) => n + f.width, 0);
    expect(fields.filter((f) => f.meaning === 'unknown')).toHaveLength(0);
    expect(bytes('unused')).toBe(461);
  });
  it('labels the production record with CPS captions and shows the serial unmasked', () => {
    const { fields } = decodeRt95Calibration(new Uint8Array(RT95_CALIBRATION_LENGTH));
    const at = (a: number) => fields.find((f) => f.address === a)!;
    expect(at(0x3b20)).toMatchObject({ label: 'Serial Number', width: 16 });
    expect(at(0x3b20).sensitive).toBeUndefined();
    expect(at(0x3b40)).toMatchObject({ width: 8 });
    expect(at(0x3b48).meaning).toBe('unused');
    expect(at(0x3ba0).note).toMatch(/Repair description/);
    expect(at(0x3b18).sensitive).toBe(true);
  });
  it('decodes BCD test-channel slices and firmware versions from synthetic bytes', () => {
    const bytes = new Uint8Array(RT95_CALIBRATION_LENGTH);
    bytes.set([0x14, 0x60, 0x00, 0x00], 0x3f40 - 0x3b00);
    bytes.set([0x0f, 0x00, 0x00, 0x00], 0x3f44 - 0x3b00);
    bytes.set([0x01, 0x11], 0x3b0b - 0x3b00);
    const { fields } = decodeRt95Calibration(bytes);
    const at = (a: number) => fields.find((f) => f.address === a)!;
    expect(at(0x3f40).decoded).toBe('146.00000 MHz');
    expect(at(0x3f44).decoded).toBe('not valid BCD');
    expect(at(0x3b0b).decoded).toBe('V1.11');
    expect(at(0x3f20).label).toBe('Squelch level steps VHF');
    expect(at(0x3f00).label).toBe('S-meter steps VHF');
  });

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
