import { describe, expect, it } from 'vitest';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { decodeRt95DebugSettings, decodeRt95DebugSlots } from './debugMemory.ts';
import { RT95_OCCUPIED_BITFIELD_OFFSET } from './constants.ts';

describe('RT95 clone debug evidence', () => {
  it('keeps exact width, custom tones and uncertain duplex, including slot 200', () => {
    const image = buildSyntheticRt95Image();
    image[10] = 4;
    image[11] = 5;
    image[12] = 0x33;
    image[13] = 0x33;
    image[30] = 0x76;
    image[31] = 3;
    image[9] = 3;
    image.set(image.subarray(0, 32), 199 * 32);
    image[RT95_OCCUPIED_BITFIELD_OFFSET + 24] = 0x80;
    const slots = decodeRt95DebugSlots(image);
    expect(slots).toHaveLength(200);
    expect(slots[0]).toMatchObject({
      width: '20 kHz',
      rxTone: 'CTCSS 88.6 Hz (custom)',
      txTone: 'CTCSS 88.6 Hz (custom)',
      tx: 'Unknown (duplex 3)',
    });
    expect(slots[199]).toMatchObject({ slot: 200, occupancy: 'occupied', name: 'TEST01' });
  });
  it('exposes invalid fields and unavailable occupancy without defaulting', () => {
    const image = buildSyntheticRt95Image();
    image[0] = 0xfa;
    image[9] = 0x0c;
    image[10] = 0x0c;
    image[11] = 3;
    expect(decodeRt95DebugSlots(image)[0]).toMatchObject({
      rx: 'Invalid BCD',
      power: '3 · invalid',
      width: 'Invalid width 3',
      txTone: 'Invalid tone mode 3',
    });
    expect(decodeRt95DebugSlots(undefined)[0]!.occupancy).toBe('unavailable');
  });
  it('uses the registry VOX bit 0 rather than retain preview bit 7', () => {
    const image = buildSyntheticRt95Image();
    image[0x321c] = 0x80;
    expect(decodeRt95DebugSettings(image).find((r) => r.label === 'VOX enable')!.value).toBe(
      'false (raw 0x80)',
    );
    image[0x321c] = 1;
    expect(decodeRt95DebugSettings(image).find((r) => r.label === 'VOX enable')!.value).toBe(
      'true (raw 0x01)',
    );
  });
});
