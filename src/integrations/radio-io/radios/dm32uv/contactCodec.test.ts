import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_LIMITS } from './constants.ts';
import {
  encodeDm32ContactEntry,
  encodeDigitalContactsIntoDm32Image,
  parseDm32ContactsRange,
  parseDm32MaxContacts,
  planDm32ContactBankBlocks,
  planDm32ContactBankWriteBlocks,
  DM32_CONTACT_ENTRY_SIZE,
  DM32_CONTACTS_PER_BLOCK,
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

  it('parses V-frame 0x10 max contacts', () => {
    const payload = new Uint8Array([0x88, 0x13, 0x00, 0x00]); // 5000
    expect(parseDm32MaxContacts(payload)).toBe(5000);
  });

  it('plans contact blocks from header count, not full L01 V-frame end', () => {
    const contactsBase = 0x278000;
    const contactsEnd = 0xfff000; // absurd span (~3464 blocks if walked)
    const planEmpty = planDm32ContactBankBlocks({
      contactsBase,
      contactsEnd,
      countFromHeader: 0,
      maxContacts: 150_000,
    });
    expect(planEmpty.blockAddresses).toEqual([0x278000]);
    expect(planEmpty.contactCount).toBe(0);

    const planFew = planDm32ContactBankBlocks({
      contactsBase,
      contactsEnd,
      countFromHeader: 50,
      maxContacts: 150_000,
    });
    expect(planFew.contactCount).toBe(50);
    expect(planFew.blockAddresses).toHaveLength(Math.ceil(50 / DM32_CONTACTS_PER_BLOCK));
    expect(planFew.blockAddresses.length).toBeLessThan(DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS);

    const planGarbage = planDm32ContactBankBlocks({
      contactsBase,
      contactsEnd,
      countFromHeader: 0xffff_ffff,
      maxContacts: 150_000,
    });
    expect(planGarbage.blockAddresses).toHaveLength(1);
  });

  it('plans write blocks from contact count without walking V-frame end', () => {
    expect(planDm32ContactBankWriteBlocks(0x278000, 0)).toEqual([0x278000]);
    expect(planDm32ContactBankWriteBlocks(0x278000, 45)).toEqual([0x278000, 0x279000]);
    expect(planDm32ContactBankWriteBlocks(0x278000, 50_000).length).toBe(
      DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS,
    );
  });

  it('writes count header and first contact into map', () => {
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

  it('clears stale entries in earlier blocks when contact list shrinks', () => {
    const contactsBase = 0;
    const contactsEnd = DM32_BLOCK_SIZE * 2 - 1;
    const image = createMemoryMap(DM32_BLOCK_SIZE * 2);
    image.bytes.fill(0x00);

    const stale = encodeDm32ContactEntry({
      wireName: 'Stale',
      digitalId: 999,
      callsign: '',
      city: '',
      province: '',
      country: '',
      remark: '',
    });
    const staleOff = DM32_BLOCK_SIZE;
    image.set(staleOff, stale);

    encodeDigitalContactsIntoDm32Image(
      image,
      { addressBase: 0, contactsBase, contactsEnd, discoveredAddresses: [0, DM32_BLOCK_SIZE] },
      [
        {
          wireName: 'Only',
          digitalId: 1,
          callsign: '',
          city: '',
          province: '',
          country: '',
          remark: '',
        },
      ],
    );

    expect(image.bytes[0]).toBe(1);
    expect(image.bytes[0x10]).toBe('O'.charCodeAt(0));
    expect(image.bytes[staleOff]).toBe(0xff);
    expect(image.bytes[staleOff + 1]).toBe(0xff);
  });

  it('does not clear thousands of blocks when V-frame end is near 0xFFF000', () => {
    const contactsBase = 0;
    const contactsEnd = 0xfff000;
    const image = createMemoryMap(DM32_BLOCK_SIZE * 2);
    image.bytes.fill(0xff);
    // Untrusted huge span → encode packs only needed blocks; leave block 1 alone.
    image.bytes[DM32_BLOCK_SIZE] = 'Z'.charCodeAt(0);
    encodeDigitalContactsIntoDm32Image(
      image,
      {
        addressBase: 0,
        contactsBase,
        contactsEnd,
        discoveredAddresses: [0, DM32_BLOCK_SIZE],
      },
      [
        {
          wireName: 'One',
          digitalId: 1,
          callsign: '',
          city: '',
          province: '',
          country: '',
          remark: '',
        },
      ],
    );
    expect(image.bytes[contactsBase]).toBe(1);
    expect(image.bytes[0x10]).toBe('O'.charCodeAt(0));
    expect(image.bytes[DM32_BLOCK_SIZE]).toBe('Z'.charCodeAt(0));
  });
});
