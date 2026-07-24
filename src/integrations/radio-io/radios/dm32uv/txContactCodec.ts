/**
 * DM-32UV TX-contact bank encoding (metadata 0x42 / 0x43).
 * Cite: NeonPlug structures.ts encodeTxContactEntry / getTxContactOffset.
 */

import { DM32_METADATA } from './constants.ts';

export function parseTxContactEntry(
  byte0: number,
  byte1: number,
): { contactId: number; isDigital: boolean } {
  const contactIdHigh = (byte0 >> 4) & 0x0f;
  const contactIdLow = byte1 & 0xff;
  const contactId = (contactIdHigh << 8) | contactIdLow;
  const isDigital = (byte0 & 0x01) !== 0;
  return { contactId, isDigital };
}

export function encodeTxContactEntry(contactId: number, isDigital: boolean): [number, number] {
  const clampedId = Math.max(0, Math.min(4095, contactId));
  const contactIdHigh = (clampedId >> 8) & 0x0f;
  const contactIdLow = clampedId & 0xff;
  const byte0 = (contactIdHigh << 4) | (isDigital ? 0x01 : 0x00);
  const byte1 = contactIdLow;
  return [byte0, byte1];
}

export function getTxContactOffset(channelNumber: number): {
  blockMetadata: number;
  offset: number;
} {
  if (channelNumber === 4001) {
    return { blockMetadata: DM32_METADATA.TX_CONTACT_HIGH, offset: 0x0ffa };
  }
  if (channelNumber === 4002) {
    return { blockMetadata: DM32_METADATA.TX_CONTACT_HIGH, offset: 0x0ffc };
  }
  if (channelNumber >= 1 && channelNumber <= 2047) {
    return { blockMetadata: DM32_METADATA.TX_CONTACT_LOW, offset: (channelNumber - 1) * 2 };
  }
  if (channelNumber >= 2048) {
    return { blockMetadata: DM32_METADATA.TX_CONTACT_HIGH, offset: (channelNumber & 0x7ff) * 2 };
  }
  return { blockMetadata: DM32_METADATA.TX_CONTACT_LOW, offset: 0 };
}

export function isDigitalChannelMode(mode: string | undefined): boolean {
  return mode === 'digital' || mode === 'fixed-digital';
}
