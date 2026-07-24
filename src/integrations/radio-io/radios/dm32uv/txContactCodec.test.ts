import { describe, expect, it } from 'vitest';
import { encodeTxContactEntry, getTxContactOffset, parseTxContactEntry } from './txContactCodec.ts';
import { DM32_METADATA } from './constants.ts';

describe('txContactCodec', () => {
  // Golden bytes derived from NeonPlug encodeTxContactEntry (structures.ts).
  it.each([
    { contactId: 1, isDigital: true, expected: [0x01, 0x01] as const },
    { contactId: 1, isDigital: false, expected: [0x00, 0x01] as const },
    { contactId: 256, isDigital: true, expected: [0x11, 0x00] as const },
    { contactId: 2047, isDigital: true, expected: [0x71, 0xff] as const },
    { contactId: 2048, isDigital: true, expected: [0x81, 0x00] as const },
  ])('encodeTxContactEntry($contactId, $isDigital)', ({ contactId, isDigital, expected }) => {
    expect(encodeTxContactEntry(contactId, isDigital)).toEqual([...expected]);
  });

  it('round-trips parse ↔ encode', () => {
    for (const contactId of [0, 1, 256, 2047, 2048, 4095]) {
      for (const isDigital of [true, false]) {
        const [b0, b1] = encodeTxContactEntry(contactId, isDigital);
        const parsed = parseTxContactEntry(b0, b1);
        expect(parsed.contactId).toBe(Math.min(contactId, 4095));
        expect(parsed.isDigital).toBe(isDigital);
      }
    }
  });

  it('getTxContactOffset places 2047 in 0x42 and 2048 in 0x43', () => {
    expect(getTxContactOffset(2047)).toEqual({
      blockMetadata: DM32_METADATA.TX_CONTACT_LOW,
      offset: (2047 - 1) * 2,
    });
    expect(getTxContactOffset(2048)).toEqual({
      blockMetadata: DM32_METADATA.TX_CONTACT_HIGH,
      offset: (2048 & 0x7ff) * 2,
    });
  });
});
