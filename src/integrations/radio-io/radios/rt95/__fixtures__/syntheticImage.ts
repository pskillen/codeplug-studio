import {
  RT95_BANDLIMIT_OFFSET,
  RT95_BITFIELD_BYTES,
  RT95_CHANNEL_RECORD_SIZE,
  RT95_IMAGE_SIZE,
  RT95_OCCUPIED_BITFIELD_OFFSET,
  RT95_SCAN_BITFIELD_OFFSET,
} from '../constants.ts';
import { encodeBcdFreq } from '../bcd.ts';
import { getBitfieldBit } from '../bitfield.ts';

/** Synthetic 0x32A0 image with one occupied channel at slot 1 (fixtures.md recipe). */
export function buildSyntheticRt95Image(): Uint8Array {
  const image = new Uint8Array(RT95_IMAGE_SIZE);
  image.fill(0xff);

  const ch = new Uint8Array(RT95_CHANNEL_RECORD_SIZE);
  ch.fill(0);
  ch.set(encodeBcdFreq(146_520_000), 0);
  ch.set(encodeBcdFreq(146_520_000), 4);
  ch[9] = 0x02 << 4;
  ch[10] = 0x02 << 4;
  const name = new TextEncoder().encode('TEST01');
  ch.set(name, 24);

  image.set(ch, 0);
  image[RT95_OCCUPIED_BITFIELD_OFFSET] = 0x01;
  image[RT95_BANDLIMIT_OFFSET] = 0x01;

  return image;
}

export function occupiedBitAt(image: Uint8Array, memoryNumber: number): boolean {
  return getBitfieldBit(image, RT95_OCCUPIED_BITFIELD_OFFSET, memoryNumber);
}

export function scanBitAt(image: Uint8Array, memoryNumber: number): boolean {
  return getBitfieldBit(image, RT95_SCAN_BITFIELD_OFFSET, memoryNumber);
}

export { RT95_BITFIELD_BYTES };
