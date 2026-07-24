import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE } from './constants.ts';
import {
  encodeDm32ContactEntry,
  encodeDigitalContactsIntoDm32Image,
  parseDm32ContactsRange,
  DM32_CONTACT_ENTRY_SIZE,
} from './contactCodec.ts';

describe('contactCodec', () => {
  it('encodes a 92-byte entry with name and DMR id', () => {
    const rec = encodeDm32ContactEntry({
      wireName: 'Alice',
      digitalId: 1234567,
      callsign: 'W1AW',
      city: '',
      province: '',
      country: '',
      remark: '',
    });
    expect(rec.length).toBe(DM32_CONTACT_ENTRY_SIZE);
    expect(rec[0]).toBe('A'.charCodeAt(0));
    expect(rec[0x10] | (rec[0x11]! << 8) | (rec[0x12]! << 16) | (rec[0x13]! << 24)).toBe(1234567);
  });

  it('parses V-frame contact range', () => {
    const payload = new Uint8Array(8);
    payload[0] = 0x00;
    payload[1] = 0x00;
    payload[2] = 0x20;
    payload[3] = 0x00; // start 0x200000
    payload[4] = 0xff;
    payload[5] = 0x0f;
    payload[6] = 0x20;
    payload[7] = 0x00; // end
    expect(parseDm32ContactsRange(payload)).toEqual({ start: 0x200000, end: 0x200fff });
  });

  it('writes count header and first contact into map', () => {
    // Count header sits at contactsBase; first entry at +0x10 within the block.
    const contactsBase = 0;
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.bytes.fill(0xff);
    encodeDigitalContactsIntoDm32Image(
      image,
      { addressBase: 0, contactsBase, discoveredAddresses: [0] },
      [
        {
          wireName: 'Bob',
          digitalId: 9,
          callsign: '',
          city: '',
          province: '',
          country: '',
          remark: '',
        },
      ],
    );
    expect(image.bytes[contactsBase]).toBe(1);
    expect(image.bytes[0x10]).toBe('B'.charCodeAt(0));
  });
});
