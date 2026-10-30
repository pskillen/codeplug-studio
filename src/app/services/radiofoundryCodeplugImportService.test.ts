import { describe, expect, it, vi } from 'vitest';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
// Layout constants for a hand-built image. This test does not call the format adapter.
// eslint-disable-next-line no-restricted-imports
import {
  CHANNEL_RECORD_SIZE,
  CHANNELS_PER_BANK,
  GENERAL_SETTINGS,
  RADIOFOUNDRY_IMAGE_SIZE,
  RX_LIST_LENGTH,
  RX_LIST_LENGTH_SIZE,
  ZONE_BITMAP,
  ZONE_BITMAP_SIZE,
  ZONE_RECORD_SIZE,
  channelSlotAddress,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import { importRadioFoundryCodeplug } from './radiofoundryCodeplugImportService.ts';

const LIMITS = DM32UV_RADIOFOUNDRY_LIMITS;
const PROJECT_ID = 'proj-rf';

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

/** One FM channel and one zone. Built from layout constants, not the exporter. */
function handBuiltImage(): Uint8Array {
  const image = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);
  image.fill(0xff);
  const banks = LIMITS.CHANNEL_MAX / CHANNELS_PER_BANK;
  const bitmapBytes = CHANNELS_PER_BANK / 8;
  for (let bank = 0; bank < banks; bank++) {
    const slot = channelSlotAddress(bank * CHANNELS_PER_BANK + 1);
    image.fill(0, slot.bitmap, slot.bitmap + bitmapBytes);
  }
  const zoneBytes = ZONE_BITMAP_SIZE + LIMITS.ZONE_MAX * ZONE_RECORD_SIZE;
  image.fill(0, ZONE_BITMAP, ZONE_BITMAP + zoneBytes);
  image.fill(0, RX_LIST_LENGTH, RX_LIST_LENGTH + RX_LIST_LENGTH_SIZE);
  writeAscii(image, GENERAL_SETTINGS, 'MM9PDY', LIMITS.RADIO_NAME_MAX);
  writeBcd(image, GENERAL_SETTINGS + 8, 2_351_234);

  const slot = channelSlotAddress(1);
  const at = slot.bitmap + (slot.bitIndex >> 3);
  image[at] = (image[at] ?? 0) | (1 << (slot.bitIndex & 7));
  const record = image.subarray(slot.record, slot.record + CHANNEL_RECORD_SIZE);
  record.fill(0);
  writeAscii(record, 0, 'Local', LIMITS.NAME_MAX);
  record[0x18] = 0;

  image[ZONE_BITMAP] = 0x01;
  const zone = ZONE_BITMAP + ZONE_BITMAP_SIZE;
  writeAscii(image, zone, 'Home', LIMITS.NAME_MAX);
  writeU16(image, zone + LIMITS.NAME_MAX, 1);
  return image;
}

describe('importRadioFoundryCodeplug', () => {
  it('parses a hand-built image and persists a channel and a zone', async () => {
    const store = new InMemoryProjectPersistence();
    const putChannel = vi.spyOn(store, 'putChannel');
    const putZone = vi.spyOn(store, 'putZone');

    const result = await importRadioFoundryCodeplug(PROJECT_ID, handBuiltImage(), store);

    expect(result).toEqual({ ok: true, channelCount: 1, zoneCount: 1 });
    expect(putChannel).toHaveBeenCalledTimes(1);
    expect(putZone).toHaveBeenCalledTimes(1);
    const channel = putChannel.mock.calls[0]?.[0];
    const zone = putZone.mock.calls[0]?.[0];
    expect(channel).toMatchObject({ projectId: PROJECT_ID, name: 'Local' });
    expect(zone).toMatchObject({
      projectId: PROJECT_ID,
      name: 'Home',
      members: [{ kind: 'channel', channelId: channel?.id }],
    });
    expect(await store.listChannels(PROJECT_ID)).toHaveLength(1);
    expect(await store.listZones(PROJECT_ID)).toHaveLength(1);
    expect(await store.listOwnDigitalIds(PROJECT_ID)).toHaveLength(1);
  });

  it('surfaces a short-file parser error and writes nothing', async () => {
    const store = new InMemoryProjectPersistence();
    const putChannel = vi.spyOn(store, 'putChannel');
    const putZone = vi.spyOn(store, 'putZone');
    const putTalkGroup = vi.spyOn(store, 'putTalkGroup');
    const putDigitalContact = vi.spyOn(store, 'putDigitalContact');
    const putRxGroupList = vi.spyOn(store, 'putRxGroupList');
    const putOwnDigitalId = vi.spyOn(store, 'putOwnDigitalId');

    const result = await importRadioFoundryCodeplug(PROJECT_ID, new Uint8Array(32), store);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/at least 716384 bytes/);
    expect(putChannel).not.toHaveBeenCalled();
    expect(putZone).not.toHaveBeenCalled();
    expect(putTalkGroup).not.toHaveBeenCalled();
    expect(putDigitalContact).not.toHaveBeenCalled();
    expect(putRxGroupList).not.toHaveBeenCalled();
    expect(putOwnDigitalId).not.toHaveBeenCalled();
    expect(await store.listChannels(PROJECT_ID)).toEqual([]);
    expect(await store.listZones(PROJECT_ID)).toEqual([]);
  });
});
