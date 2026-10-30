import { describe, expect, it } from 'vitest';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import { isBinaryCpsImportAdapter } from '../../importAdapter.ts';
import { getImportAdapter } from '../../registry.ts';
import type { BinaryCpsImportResult } from '../../types.ts';
import {
  ALL_CALL_DMR_ID,
  CHANNEL_RECORD_SIZE,
  CHANNELS_PER_BANK,
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
  GENERAL_SETTINGS,
  RADIOFOUNDRY_IMAGE_SIZE,
  RX_LIST_BASE,
  RX_LIST_LENGTH,
  RX_LIST_LENGTH_SIZE,
  ZONE_BITMAP,
  ZONE_BITMAP_SIZE,
  ZONE_LAYOUT_BYTE,
  ZONE_RECORD_SIZE,
  ZONE_RECORD_SIZE_16,
  channelSlotAddress,
} from './layout.ts';

const LIMITS = DM32UV_RADIOFOUNDRY_LIMITS;

function parse(bytes: Uint8Array): BinaryCpsImportResult {
  const adapter = getImportAdapter('radiofoundry');
  if (!isBinaryCpsImportAdapter(adapter)) {
    throw new Error('RadioFoundry import adapter is not registered');
  }
  return adapter.parse(bytes, 'proj');
}

function writeAscii(target: Uint8Array, offset: number, text: string, length: number): void {
  for (let i = 0; i < length; i++) target[offset + i] = 0xff;
  for (let i = 0; i < text.length && i < length; i++) target[offset + i] = text.charCodeAt(i);
}

function writeBcd(target: Uint8Array, offset: number, value: number): void {
  const digits = value.toString(10).padStart(8, '0');
  for (let i = 0; i < 4; i++) {
    const hi = digits.charCodeAt(i * 2) - 48;
    const lo = digits.charCodeAt(i * 2 + 1) - 48;
    target[offset + i] = (hi << 4) | lo;
  }
}

function writeU16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >> 8) & 0xff;
}

function zeroChannelBitmaps(image: Uint8Array): void {
  const banks = LIMITS.CHANNEL_MAX / CHANNELS_PER_BANK;
  const bitmapBytes = CHANNELS_PER_BANK / 8;
  for (let bank = 0; bank < banks; bank++) {
    const slot = channelSlotAddress(bank * CHANNELS_PER_BANK + 1);
    image.fill(0, slot.bitmap, slot.bitmap + bitmapBytes);
  }
}

function channelRecord(image: Uint8Array, number: number): Uint8Array {
  const slot = channelSlotAddress(number);
  const at = slot.bitmap + (slot.bitIndex >> 3);
  image[at] = (image[at] ?? 0) | (1 << (slot.bitIndex & 7));
  const record = image.subarray(slot.record, slot.record + CHANNEL_RECORD_SIZE);
  record.fill(0);
  return record;
}

/** 80-channel zone table, empty contact bank, no channels. Radio ID is valid BCD. */
function eightyChannelImage(): Uint8Array {
  const image = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);
  image.fill(0xff);
  zeroChannelBitmaps(image);
  const zoneBytes = ZONE_BITMAP_SIZE + LIMITS.ZONE_MAX * ZONE_RECORD_SIZE;
  image.fill(0, ZONE_BITMAP, ZONE_BITMAP + zoneBytes);
  image.fill(0, RX_LIST_LENGTH, RX_LIST_LENGTH + RX_LIST_LENGTH_SIZE);
  writeAscii(image, GENERAL_SETTINGS, 'MM9PDY', LIMITS.RADIO_NAME_MAX);
  writeBcd(image, GENERAL_SETTINGS + 8, 2_351_234);
  return image;
}

function contactOffset(slot: number): number {
  return CONTACT_BASE + (slot - 1) * CONTACT_RECORD_SIZE;
}

function writeContact(
  image: Uint8Array,
  slot: number,
  name: string,
  callType: number,
  digitalId: number,
): void {
  const offset = contactOffset(slot);
  writeAscii(image, offset, name, LIMITS.NAME_MAX);
  writeBcd(image, offset + 0x10, digitalId);
  image[offset + 0x14] = callType;
  image[offset + 0x17] = 0x01;
}

/** Hand-built image. Does not call the exporter. */
function sampleImage(): Uint8Array {
  const image = eightyChannelImage();

  const fm = channelRecord(image, 1);
  writeAscii(fm, 0, 'Local', LIMITS.NAME_MAX);
  fm.set([0x00, 0x00, 0x55, 0x14], 0x10);
  fm.set([0x00, 0x00, 0x50, 0x14], 0x14);
  fm[0x18] = 0;
  fm[0x19] = 0;
  fm.set([0x85, 0x08], 0x20);
  fm.set([0x23, 0x80], 0x22);
  fm[0x33] = 0x02;
  fm[0x37] = 10;

  const dmr = channelRecord(image, 2);
  writeAscii(dmr, 0, 'Repeater', LIMITS.NAME_MAX);
  dmr.set([0x00, 0x00, 0x85, 0x43], 0x10);
  dmr.set([0x00, 0x00, 0x85, 0x43], 0x14);
  dmr[0x18] = 1;
  dmr[0x19] = 2;
  dmr[0x1a] = 0x1c;
  dmr[0x1c] = 0xa5;
  dmr[0x1d] = 0x1b;
  dmr[0x1e] = 0xd0;
  dmr[0x1f] = 0x87;
  dmr[0x24] = 0x81;
  dmr[0x26] = 0x8c;
  dmr.set([0x12, 0xd6, 0x87], 0x27);
  dmr[0x2b] = 1;
  dmr[0x2c] = 7;
  writeU16(dmr, 0x2e, 2);
  dmr[0x30] = 0x08;
  dmr[0x31] = 0x40;
  dmr[0x33] = 0x24;

  writeContact(image, 2, 'Town', 0, 9);
  writeAscii(image, contactOffset(3), 'Ghost', LIMITS.NAME_MAX);
  writeContact(image, 4, 'All', 2, 1);
  writeContact(image, 5, 'Alice', 1, 12_345);

  image[RX_LIST_LENGTH] = 2;
  writeAscii(image, RX_LIST_BASE, 'Towns', LIMITS.NAME_MAX);
  writeU16(image, RX_LIST_BASE + LIMITS.NAME_MAX, 2);

  image[ZONE_BITMAP] = 0x01;
  const zone = ZONE_BITMAP + ZONE_BITMAP_SIZE;
  writeAscii(image, zone, 'Home', LIMITS.NAME_MAX);
  writeU16(image, zone + LIMITS.NAME_MAX, 1);
  return image;
}

describe('parseRadioFoundryCodeplug', () => {
  it('reads channels, contacts, an RX list, a zone, and the radio ID', () => {
    const parsed = parse(sampleImage());
    expect(parsed.channels.map((row) => row.name)).toEqual(['Local', 'Repeater']);

    const fm = parsed.channels[0];
    expect(fm?.projectId).toBe('proj');
    expect(fm?.rxFrequency).toBe(145_500_000);
    expect(fm?.txFrequency).toBe(145_000_000);
    expect(fm?.power).toBeNull();
    expect(fm?.primaryMode).toBe('fm');
    expect(fm?.scanInclusion).toBe('alwaysScan');
    expect(fm?.forbidTransmit).toBe('allow');
    expect(fm?.useLocation).toBe(false);
    expect(fm?.modeProfiles[0]).toMatchObject({
      mode: 'fm',
      squelch: 48,
      rxTone: '88.5',
      txTone: 'D023N',
      bandwidthKHz: 25,
    });

    const town = parsed.talkGroups.find((row) => row.name === 'Town');
    const all = parsed.talkGroups.find((row) => row.name === 'All');
    const alice = parsed.digitalContacts[0];
    const rx = parsed.rxGroupLists[0];
    const override = parsed.ownDigitalIds.find((row) => !row.isDefault);
    expect(parsed.talkGroups.map((row) => [row.name, row.digitalId])).toEqual([
      ['Town', 9],
      ['All', ALL_CALL_DMR_ID],
    ]);
    expect(parsed.digitalContacts.map((row) => [row.name, row.digitalId])).toEqual([
      ['Alice', 12_345],
    ]);
    expect(parsed.talkGroups.some((row) => row.name === 'Ghost')).toBe(false);

    const dmr = parsed.channels[1];
    expect(dmr?.rxFrequency).toBe(438_500_000);
    expect(dmr?.power).toBe(13);
    expect(dmr?.forbidTransmit).toBe('forbid');
    expect(dmr?.scanInclusion).toBe('skip');
    expect(dmr?.useLocation).toBe(true);
    expect(dmr?.location?.lat).toBeCloseTo(55.95, 4);
    expect(dmr?.location?.lon).toBeCloseTo(-3.2, 4);
    expect(dmr?.modeProfiles[0]).toMatchObject({
      mode: 'dmr',
      dmrMode: 'dmo-simplex',
      colourCode: 7,
      timeslot: 2,
      sendTalkerAlias: 'on',
      contactRef: { kind: 'talkGroup', id: town?.id },
      rxGroupListId: rx?.id,
      ownDigitalIdId: override?.id,
    });

    expect(rx?.name).toBe('Towns');
    expect(rx?.members).toEqual([{ ref: { kind: 'talkGroup', id: town?.id } }]);
    expect(parsed.zones.map((row) => row.name)).toEqual(['Home']);
    expect(parsed.zones[0]?.members).toEqual([{ kind: 'channel', channelId: fm?.id }]);

    expect(parsed.ownDigitalIds[0]).toMatchObject({
      name: 'MM9PDY',
      number: 2_351_234,
      protocol: 'dmr',
      isDefault: true,
    });
    expect(override).toMatchObject({ name: '', number: 1_234_567, isDefault: false });
    expect(all?.mode).toBe('dmr');
    expect(alice?.mode).toBe('dmr');
  });

  it('rejects a short file', () => {
    expect(() => parse(new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE - 1))).toThrow(
      /at least 716384 bytes/,
    );
  });

  it('ignores bytes past the codeplug image', () => {
    const image = sampleImage();
    const padded = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE + 64);
    padded.set(image);
    padded.set(new TextEncoder().encode('PaddingTG'), RADIOFOUNDRY_IMAGE_SIZE);
    const parsed = parse(padded);
    const names = [
      ...parsed.channels.map((row) => row.name),
      ...parsed.talkGroups.map((row) => row.name),
      ...parsed.digitalContacts.map((row) => row.name),
      ...parsed.rxGroupLists.map((row) => row.name),
      ...parsed.zones.map((row) => row.name),
      ...parsed.ownDigitalIds.map((row) => row.name),
    ];
    expect(names).not.toContain('PaddingTG');
    expect(parsed.channels.map((row) => row.name)).toEqual(['Local', 'Repeater']);
    expect(parsed.talkGroups.map((row) => row.name)).toEqual(['Town', 'All']);
  });

  it('reads the 16-channel zone layout from the record stride', () => {
    const image = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);
    image.fill(0xff);
    zeroChannelBitmaps(image);
    image.fill(0, RX_LIST_LENGTH, RX_LIST_LENGTH + RX_LIST_LENGTH_SIZE);
    image.fill(0, ZONE_BITMAP, ZONE_BITMAP + ZONE_BITMAP_SIZE);
    writeAscii(image, GENERAL_SETTINGS, 'MM9PDY', LIMITS.RADIO_NAME_MAX);
    writeBcd(image, GENERAL_SETTINGS + 8, 2_351_234);
    const fm = channelRecord(image, 1);
    writeAscii(fm, 0, 'Local', LIMITS.NAME_MAX);
    fm.set([0x00, 0x00, 0x55, 0x14], 0x10);
    fm[0x18] = 0;

    const zone0 = ZONE_BITMAP + ZONE_BITMAP_SIZE;
    writeAscii(image, zone0, 'Short', LIMITS.NAME_MAX);
    writeU16(image, zone0 + LIMITS.NAME_MAX, 1);
    const zone1 = zone0 + ZONE_RECORD_SIZE_16;
    writeAscii(image, zone1, 'Next', LIMITS.NAME_MAX);
    writeU16(image, zone1 + LIMITS.NAME_MAX, 0);
    image[ZONE_BITMAP] = 0x03;
    expect(image[ZONE_LAYOUT_BYTE]).toBe(0xff);

    const parsed = parse(image);
    expect(parsed.zones.map((row) => row.name)).toEqual(['Short', 'Next']);
    expect(parsed.zones[0]?.members).toEqual([
      { kind: 'channel', channelId: parsed.channels[0]?.id },
    ]);
    expect(parsed.zones[1]?.members).toEqual([]);
  });

  it('rejects a zone layout byte that is neither layout', () => {
    const image = eightyChannelImage();
    image[ZONE_LAYOUT_BYTE] = 0x20;
    expect(() => parse(image)).toThrow(/zone layout/);
  });
});
