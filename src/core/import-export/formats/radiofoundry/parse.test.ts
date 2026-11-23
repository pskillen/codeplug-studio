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
  SETTINGS_AREA_ADDRESS,
  SETTINGS_AREA_SIZE,
  ZONE_BITMAP,
  ZONE_BITMAP_SIZE,
  ZONE_LAYOUT_BYTE,
  ZONE_RECORD_SIZE,
  ZONE_RECORD_SIZE_16,
  channelSlotAddress,
} from './layout.ts';
import {
  newChannel,
  newOwnDigitalId,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { serialiseRadioFoundryCodeplug } from './serialise.ts';
import { radioFoundryNameCheck } from './channelTags.ts';
import { CHANNEL_TAG_KEY_FIRST as CHANNEL_TAG_KEY_FIRST_FOR_TEST } from './channelTags.ts';
import { crc32 } from './settingsArea.ts';

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

  describe('warnings', () => {
    function writeSettingsArea(
      image: Uint8Array,
      entries: [number, number[]][],
      { version = 1, magic = true }: { version?: number; magic?: boolean } = {},
    ): void {
      const data = entries.flatMap(([key, value]) => [
        key & 0xff,
        key >> 8,
        value.length & 0xff,
        value.length >> 8,
        ...value,
      ]);
      const sector = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
      const crc = crc32(Uint8Array.from(data));
      sector.fill(0, 0, 16);
      sector.set([0x52, 0x46, 0x4b, 0x56, version, 16, data.length & 0xff, data.length >> 8], 0);
      sector.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], 8);
      sector.set(data, 16);
      if (!magic) sector[0] = 0x00;
      image.set(sector, SETTINGS_AREA_ADDRESS);
    }

    function tagFor(image: Uint8Array, number: number, kind: number, flags: number): number[] {
      const record = image.subarray(
        channelSlotAddress(number).record,
        channelSlotAddress(number).record + CHANNEL_RECORD_SIZE,
      );
      const check = radioFoundryNameCheck(record.subarray(0, 16));
      return [kind, 0xff, check & 0xff, check >> 8, flags];
    }

    it('has no warnings for a clean image', () => {
      expect(parse(sampleImage()).warnings).toEqual([]);
    });

    it('imports an unknown mode byte as FM and keeps its zone member', () => {
      const image = eightyChannelImage();
      const odd = channelRecord(image, 1);
      writeAscii(odd, 0, 'Odd', LIMITS.NAME_MAX);
      odd[0x18] = 5;
      image[ZONE_BITMAP] = 0x01;
      const zone = ZONE_BITMAP + ZONE_BITMAP_SIZE;
      writeAscii(image, zone, 'Home', LIMITS.NAME_MAX);
      writeU16(image, zone + LIMITS.NAME_MAX, 1);

      const parsed = parse(image);
      expect(parsed.channels.map((row) => [row.name, row.primaryMode])).toEqual([['Odd', 'fm']]);
      expect(parsed.zones[0]?.members).toEqual([
        { kind: 'channel', channelId: parsed.channels[0]?.id },
      ]);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0]).toContain('Channel 1 "Odd"');
      expect(parsed.warnings[0]).toContain('0x05');
    });

    it('names a zone member that points at an empty channel', () => {
      const image = sampleImage();
      const zone = ZONE_BITMAP + ZONE_BITMAP_SIZE;
      writeU16(image, zone + LIMITS.NAME_MAX + 2, 37);
      const parsed = parse(image);
      expect(parsed.zones[0]?.members).toHaveLength(1);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0]).toContain('Zone "Home"');
      expect(parsed.warnings[0]).toContain('channel 37');
    });

    it('lists several empty members of one zone in one line', () => {
      const image = sampleImage();
      const zone = ZONE_BITMAP + ZONE_BITMAP_SIZE;
      writeU16(image, zone + LIMITS.NAME_MAX + 2, 12);
      writeU16(image, zone + LIMITS.NAME_MAX + 4, 40);
      writeU16(image, zone + LIMITS.NAME_MAX + 6, 41);
      const parsed = parse(image);
      expect(parsed.warnings).toHaveLength(1);
      expect(parsed.warnings[0]).toContain('channels 12, 40 and 41');
    });

    it('says nothing about an erased settings area', () => {
      const image = sampleImage();
      image.fill(0xff, SETTINGS_AREA_ADDRESS, SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE);
      expect(parse(image).warnings).toEqual([]);
    });

    it('reports a settings area that is not valid, or newer than Studio knows', () => {
      const bad = sampleImage();
      writeSettingsArea(bad, [], { magic: false });
      const badWarnings = parse(bad).warnings;
      expect(badWarnings).toHaveLength(1);
      expect(badWarnings[0]).toContain('not valid');

      const newer = sampleImage();
      writeSettingsArea(newer, [], { version: 2 });
      const newerWarnings = parse(newer).warnings;
      expect(newerWarnings).toHaveLength(1);
      expect(newerWarnings[0]).toContain('newer RadioFoundry');
      expect(newerWarnings[0]).toContain('version 2');
    });

    it('reports a live P25 tag over a receive-only DMR stand-in, then a stale one after a rename', () => {
      const image = sampleImage();
      writeSettingsArea(image, [[CHANNEL_TAG_KEY_FIRST_FOR_TEST + 1, tagFor(image, 2, 2, 0x01)]]);
      const live = parse(image).warnings;
      expect(live).toHaveLength(1);
      expect(live[0]).toContain('Channel 2 "Repeater"');
      expect(live[0]).toContain('P25 conventional');
      expect(live[0]).toContain('receive-only DMR');

      const renamed = sampleImage();
      writeSettingsArea(renamed, [
        [CHANNEL_TAG_KEY_FIRST_FOR_TEST + 1, tagFor(renamed, 2, 2, 0x01)],
      ]);
      const record = renamed.subarray(
        channelSlotAddress(2).record,
        channelSlotAddress(2).record + CHANNEL_RECORD_SIZE,
      );
      writeAscii(record, 0, 'Renamed', LIMITS.NAME_MAX);
      const stale = parse(renamed).warnings;
      expect(stale).toHaveLength(1);
      expect(stale[0]).toContain('1 RadioFoundry channel tag no longer matches');
      expect(stale[0]).not.toContain('P25');
    });

    it('reports a tag whose base stands alone as imported with its own settings only', () => {
      const image = sampleImage();
      writeSettingsArea(image, [[CHANNEL_TAG_KEY_FIRST_FOR_TEST, tagFor(image, 1, 4, 0x03)]]);
      const warnings = parse(image).warnings;
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Channel 1 "Local" is also a NXDN conventional');
      expect(warnings[0]).toContain('only its FM settings');
    });

    it('counts other settings without showing any value', () => {
      const image = sampleImage();
      writeSettingsArea(image, [
        [0x0300, [0xde, 0xad, 0xbe, 0xef]],
        [0x0a02, [0xde, 0xad, 0xbe, 0xef, 0x22]],
      ]);
      const warnings = parse(image).warnings;
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('2 RadioFoundry settings');
      const joined = warnings.join('\n');
      for (const leak of ['DEAD', 'dead', '222', '0xde', '0300', '0a02', '768']) {
        expect(joined).not.toContain(leak);
      }
    });
  });

  it('folds timeslot clones back into one talk group on read', () => {
    const tg = newTalkGroup('proj', 'X', 2355);
    const rgl = {
      ...newRxGroupList('proj', 'List'),
      members: [{ ref: { kind: 'talkGroup' as const, id: tg.id }, timeSlotOverride: 1 as const }],
    };
    const dmr: ChannelModeProfileDMR = {
      mode: 'dmr',
      colourCode: 1,
      timeslot: 2,
      ownDigitalIdId: null,
      contactRef: { kind: 'talkGroup', id: tg.id },
      rxGroupListId: rgl.id,
    };
    const channel: Channel = {
      ...newChannel('proj', 'Repeater'),
      primaryMode: 'dmr',
      rxFrequency: 430_125_000,
      txFrequency: 430_125_000,
      modeProfiles: [dmr],
    };
    const build: AssembledBuild = {
      buildId: 'b',
      formatId: 'radiofoundry',
      profileId: 'radiofoundry-dm32uv',
      buildName: 'RF',
      channels: [{ entity: channel, wireName: channel.name }],
      zones: [],
      scanLists: [],
      talkGroups: [{ entity: tg, wireName: tg.name }],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [{ entity: rgl, wireName: rgl.name }],
      ownDigitalIds: [{ ...newOwnDigitalId('proj', 'dmr', 'MM9PDY', 2_351_234), isDefault: true }],
    };
    const { bytes } = serialiseRadioFoundryCodeplug(build);
    const imported = parse(bytes);
    expect(imported.talkGroups).toHaveLength(1);
    expect(imported.talkGroups[0]?.name).toBe('X');
    expect(imported.talkGroups[0]?.digitalId).toBe(2355);
    const ch = imported.channels[0];
    const profile = ch?.modeProfiles.find((p) => p.mode === 'dmr');
    expect(profile?.mode).toBe('dmr');
    if (profile?.mode !== 'dmr') throw new Error('expected DMR');
    expect(profile.timeslot).toBe(2);
    expect(profile.contactRef).toEqual({ kind: 'talkGroup', id: imported.talkGroups[0]!.id });
    expect(imported.rxGroupLists[0]?.members[0]?.timeSlotOverride).toBe(1);
    expect(imported.rxGroupLists[0]?.members[0]?.ref).toEqual({
      kind: 'talkGroup',
      id: imported.talkGroups[0]!.id,
    });
  });
});
