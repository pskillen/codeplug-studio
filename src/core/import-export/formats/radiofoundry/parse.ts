/**
 * Read a headerless open-firmware codeplug image into library entities.
 * File offsets are the layout constants (RadioFoundry docs/spec/open-firmware-cps.md §7
 * and docs/spec/tftp.md §3). Cardinality comes from DM32UV_RADIOFOUNDRY_LIMITS.
 */

import type { SendTalkerAliasOverride } from '@core/models/channelBehaviourDefaults.ts';
import {
  newChannel,
  newDigitalContact,
  newOwnDigitalId,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import type {
  Channel,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  DigitalContact,
  OwnDigitalId,
  RxGroupList,
  TalkGroup,
  Zone,
  ZoneMemberEntry,
} from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef, GeoPoint } from '@core/models/libraryTypes.ts';
import { formatCtcssHz } from '@core/domain/tones.ts';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import type { BinaryCpsImportResult } from '../../types.ts';
import {
  ALL_CALL_DMR_ID,
  CHANNEL_RECORD_SIZE,
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
  GENERAL_SETTINGS,
  RADIOFOUNDRY_IMAGE_SIZE,
  RX_LIST_BASE,
  RX_LIST_LENGTH,
  RX_LIST_RECORD_SIZE,
  SQUELCH_LEVEL_MAX,
  ZONE_BITMAP,
  ZONE_BITMAP_SIZE,
  ZONE_LAYOUT_BYTE,
  ZONE_RECORD_SIZE,
  ZONE_RECORD_SIZE_16,
  channelSlotAddress,
} from './layout.ts';

const LIMITS = DM32UV_RADIOFOUNDRY_LIMITS;

const CALL_GROUP = 0;
const CALL_PRIVATE = 1;
const CALL_ALL = 2;

const FLAG1_DMO = 0x04;
const FLAG1_LOCATION = 0x08;
const FLAG1_DMR_ID = 0x80;
const FLAG2_TIMESLOT_2 = 0x40;
const FLAG4_BANDWIDTH_25 = 0x02;
const FLAG4_RX_ONLY = 0x04;
const FLAG4_SCAN_SKIP = 0x30;

export class RadioFoundryImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadioFoundryImportError';
  }
}

interface ZoneLayout {
  recordSize: number;
  members: number;
}

interface ParsedContacts {
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  bySlot: Map<number, EntityRef>;
}

export function parseRadioFoundryCodeplug(
  bytes: Uint8Array,
  projectId = '',
): BinaryCpsImportResult {
  if (bytes.length < RADIOFOUNDRY_IMAGE_SIZE) {
    throw new RadioFoundryImportError(
      `This RadioFoundry codeplug is ${bytes.length} bytes. It has to be at least ${RADIOFOUNDRY_IMAGE_SIZE} bytes.`,
    );
  }
  const image = bytes.subarray(0, RADIOFOUNDRY_IMAGE_SIZE);
  const zoneLayout = readZoneLayout(image);
  const radio = readRadioIdentity(image, projectId);
  const contacts = readContacts(image, projectId);
  const rxGroupLists = readRxLists(image, projectId, contacts.bySlot);
  const channels = readChannels(image, projectId, radio, contacts.bySlot, rxGroupLists.bySlot);
  const zones = readZones(image, projectId, zoneLayout, channels.byNumber);

  return {
    channels: channels.rows,
    talkGroups: contacts.talkGroups,
    digitalContacts: contacts.digitalContacts,
    rxGroupLists: rxGroupLists.rows,
    zones,
    ownDigitalIds: radio.ownDigitalIds,
  };
}

function readZoneLayout(image: Uint8Array): ZoneLayout {
  const marker = image[ZONE_LAYOUT_BYTE] ?? 0xff;
  if (marker <= 0x04) {
    return { recordSize: ZONE_RECORD_SIZE, members: LIMITS.ZONE_MEMBERS_MAX };
  }
  if (marker === 0xff) {
    return {
      recordSize: ZONE_RECORD_SIZE_16,
      members: Math.max(0, Math.floor((ZONE_RECORD_SIZE_16 - LIMITS.NAME_MAX) / 2)),
    };
  }
  const hex = marker.toString(16).padStart(2, '0').toUpperCase();
  throw new RadioFoundryImportError(
    `This RadioFoundry codeplug zone layout cannot be read (byte 0x806F is 0x${hex}). ` +
      '0x00-0x04 is 80 channels per zone. 0xFF is the 16-channel layout.',
  );
}

function readRadioIdentity(
  image: Uint8Array,
  projectId: string,
): { radioNumber: number; ownDigitalIds: OwnDigitalId[] } {
  const name = readAscii(image, GENERAL_SETTINGS, LIMITS.RADIO_NAME_MAX);
  const number = readBcd(image, GENERAL_SETTINGS + 8, 4);
  if (number == null) {
    throw new RadioFoundryImportError(
      'This RadioFoundry codeplug does not contain an 8-digit BCD radio ID.',
    );
  }
  const radio = newOwnDigitalId(projectId, 'dmr', name, number);
  radio.isDefault = true;
  return { radioNumber: number, ownDigitalIds: [radio] };
}

function readContacts(image: Uint8Array, projectId: string): ParsedContacts {
  const talkGroups: TalkGroup[] = [];
  const digitalContacts: DigitalContact[] = [];
  const bySlot = new Map<number, EntityRef>();
  for (let index = 0; index < LIMITS.CONTACTS_MAX; index++) {
    const offset = CONTACT_BASE + index * CONTACT_RECORD_SIZE;
    const first = image[offset] ?? 0xff;
    const callType = image[offset + 0x14] ?? 0xff;
    if (first === 0xff || callType === 0xff) continue;
    const name = readAscii(image, offset, LIMITS.NAME_MAX);
    const slot = index + 1;
    if (callType === CALL_ALL) {
      const row = newTalkGroup(projectId, name, ALL_CALL_DMR_ID, 'dmr');
      talkGroups.push(row);
      bySlot.set(slot, { kind: 'talkGroup', id: row.id });
      continue;
    }
    const digitalId = readBcd(image, offset + 0x10, 4);
    if (digitalId == null) continue;
    if (callType === CALL_GROUP) {
      const row = newTalkGroup(projectId, name, digitalId, 'dmr');
      talkGroups.push(row);
      bySlot.set(slot, { kind: 'talkGroup', id: row.id });
    } else if (callType === CALL_PRIVATE) {
      const row = newDigitalContact(projectId, name, digitalId, 'dmr');
      digitalContacts.push(row);
      bySlot.set(slot, { kind: 'digitalContact', id: row.id });
    }
  }
  return { talkGroups, digitalContacts, bySlot };
}

function readRxLists(
  image: Uint8Array,
  projectId: string,
  contacts: Map<number, EntityRef>,
): { rows: RxGroupList[]; bySlot: Map<number, string> } {
  const rows: RxGroupList[] = [];
  const bySlot = new Map<number, string>();
  for (let index = 0; index < LIMITS.RX_GROUPS_MAX; index++) {
    const lengthByte = image[RX_LIST_LENGTH + index] ?? 0;
    if (lengthByte === 0) continue;
    const offset = RX_LIST_BASE + index * RX_LIST_RECORD_SIZE;
    const declared = Math.min(LIMITS.RX_GROUP_MEMBERS_MAX, Math.max(0, lengthByte - 1));
    const members: RxGroupList['members'] = [];
    for (let member = 0; member < declared; member++) {
      const contactIndex = readU16(image, offset + LIMITS.NAME_MAX + member * 2);
      if (contactIndex === 0) break;
      const ref = contacts.get(contactIndex);
      if (!ref) continue;
      members.push({ ref });
    }
    const row = {
      ...newRxGroupList(projectId, readAscii(image, offset, LIMITS.NAME_MAX)),
      members,
    };
    rows.push(row);
    bySlot.set(index + 1, row.id);
  }
  return { rows, bySlot };
}

function readChannels(
  image: Uint8Array,
  projectId: string,
  radio: { radioNumber: number; ownDigitalIds: OwnDigitalId[] },
  contacts: Map<number, EntityRef>,
  rxLists: Map<number, string>,
): { rows: Channel[]; byNumber: Map<number, string> } {
  const rows: Channel[] = [];
  const byNumber = new Map<number, string>();
  for (let number = 1; number <= LIMITS.CHANNEL_MAX; number++) {
    const slot = channelSlotAddress(number);
    if (!bitmapBit(image, slot.bitmap, slot.bitIndex)) continue;
    const record = image.subarray(slot.record, slot.record + CHANNEL_RECORD_SIZE);
    const modeByte = record[0x18] ?? 0xff;
    if (modeByte !== 0 && modeByte !== 1) continue;
    const name = readAscii(record, 0, LIMITS.NAME_MAX);
    const flag4 = record[0x33] ?? 0;
    const location = readLocation(record);
    const channel: Channel = {
      ...newChannel(projectId, name),
      rxFrequency: readFrequency(record, 0x10),
      txFrequency: readFrequency(record, 0x14),
      power: powerPercent(record[0x19] ?? 0),
      location: location.location,
      useLocation: location.useLocation,
      scanInclusion: flag4 & FLAG4_SCAN_SKIP ? 'skip' : 'alwaysScan',
      forbidTransmit: flag4 & FLAG4_RX_ONLY ? 'forbid' : 'allow',
      primaryMode: modeByte === 1 ? 'dmr' : 'fm',
      modeProfiles: [
        modeByte === 1
          ? readDmrProfile(record, radio, contacts, rxLists)
          : readFmProfile(record, flag4),
      ],
    };
    rows.push(channel);
    byNumber.set(number, channel.id);
  }
  return { rows, byNumber };
}

function readFmProfile(record: Uint8Array, flag4: number): ChannelModeProfileAnalog {
  return {
    mode: 'fm',
    squelch: squelchPercent(record[0x37] ?? 0),
    rxTone: readTone(record, 0x20),
    txTone: readTone(record, 0x22),
    bandwidthKHz: flag4 & FLAG4_BANDWIDTH_25 ? 25 : 12.5,
  };
}

function readDmrProfile(
  record: Uint8Array,
  radio: { radioNumber: number; ownDigitalIds: OwnDigitalId[] },
  contacts: Map<number, EntityRef>,
  rxLists: Map<number, string>,
): ChannelModeProfileDMR {
  const flag1 = record[0x26] ?? 0;
  const color = record[0x2c] ?? 0;
  const timeslot: DMRTimeSlot = (record[0x31] ?? 0) & FLAG2_TIMESLOT_2 ? 2 : 1;
  const contactIndex = readU16(record, 0x2e);
  const rxIndex = record[0x2b] ?? 0;
  return {
    mode: 'dmr',
    dmrMode: flag1 & FLAG1_DMO ? 'dmo-simplex' : null,
    colourCode: color <= 15 ? color : null,
    timeslot,
    ownDigitalIdId: flag1 & FLAG1_DMR_ID ? ownIdOverride(record, radio) : null,
    contactRef: contactIndex === 0 ? null : (contacts.get(contactIndex) ?? null),
    rxGroupListId: rxIndex === 0 ? null : (rxLists.get(rxIndex) ?? null),
    sendTalkerAlias: readTalkerAlias(record[0x30] ?? 0, timeslot),
  };
}

function ownIdOverride(
  record: Uint8Array,
  radio: { radioNumber: number; ownDigitalIds: OwnDigitalId[] },
): string | null {
  const number = ((record[0x27] ?? 0) << 16) | ((record[0x28] ?? 0) << 8) | (record[0x29] ?? 0);
  if (number <= 0 || number === radio.radioNumber) return null;
  const existing = radio.ownDigitalIds.find((row) => !row.isDefault && row.number === number);
  if (existing) return existing.id;
  const created = newOwnDigitalId(radio.ownDigitalIds[0]?.projectId ?? '', 'dmr', '', number);
  radio.ownDigitalIds.push(created);
  return created.id;
}

function readZones(
  image: Uint8Array,
  projectId: string,
  layout: ZoneLayout,
  channels: Map<number, string>,
): Zone[] {
  const zones: Zone[] = [];
  for (let index = 0; index < LIMITS.ZONE_MAX; index++) {
    if (!bitmapBit(image, ZONE_BITMAP, index)) continue;
    const offset = ZONE_BITMAP + ZONE_BITMAP_SIZE + index * layout.recordSize;
    const members: ZoneMemberEntry[] = [];
    for (let member = 0; member < layout.members; member++) {
      const channelNumber = readU16(image, offset + LIMITS.NAME_MAX + member * 2);
      if (channelNumber === 0) break;
      const channelId = channels.get(channelNumber);
      if (!channelId) continue;
      members.push({ kind: 'channel', channelId });
    }
    zones.push({
      ...newZone(projectId, readAscii(image, offset, LIMITS.NAME_MAX)),
      members,
    });
  }
  return zones;
}

function readLocation(record: Uint8Array): { location: GeoPoint | null; useLocation: boolean } {
  if (((record[0x26] ?? 0) & FLAG1_LOCATION) === 0) {
    return { location: null, useLocation: false };
  }
  return {
    useLocation: true,
    location: {
      lat: decodeCoordinate(
        (record[0x1a] ?? 0) | ((record[0x1c] ?? 0) << 8) | ((record[0x1d] ?? 0) << 16),
      ),
      lon: decodeCoordinate(
        (record[0x1e] ?? 0) | ((record[0x1f] ?? 0) << 8) | ((record[0x24] ?? 0) << 16),
      ),
    },
  };
}

/** 24-bit fixed coordinate: sign, whole degrees, then 1/10000 degree. */
function decodeCoordinate(bits: number): number {
  const sign = bits & 0x800000 ? -1 : 1;
  const degrees = (bits >>> 15) & 0xff;
  const fraction = Math.min(bits & 0x7fff, 9999);
  return sign * (degrees + fraction / 10000);
}

/**
 * Byte 0 is the radio default. Otherwise the byte is the exporter's equal-step
 * index plus one. Store the lowest percent that step maps back to, and 100 for the top step.
 */
function powerPercent(byte: number): number | null {
  if (byte <= 0) return null;
  if (byte >= LIMITS.POWER_LEVELS) return 100;
  for (let percent = 1; percent <= 100; percent++) {
    const index = Math.min(
      LIMITS.POWER_LEVELS - 1,
      Math.floor(((percent - 1) * LIMITS.POWER_LEVELS) / 100),
    );
    if (index + 1 === byte) return percent;
  }
  return null;
}

/** Level 0 is the radio default. Above 21 is read as level 10. */
function squelchPercent(level: number): number | null {
  if (level <= 0) return null;
  const stored = level > SQUELCH_LEVEL_MAX ? 10 : level;
  return Math.round((stored * 100) / SQUELCH_LEVEL_MAX);
}

function readTone(bytes: Uint8Array, offset: number): ChannelModeProfileAnalog['rxTone'] {
  const word = readU16(bytes, offset);
  if (word === 0 || word === 0xffff) return 'none';
  if (word & 0x8000) {
    const code = (word & 0x0fff).toString(16).padStart(3, '0').toUpperCase();
    return `D${code}${word & 0x4000 ? 'I' : 'N'}`;
  }
  const hex = word.toString(16).padStart(4, '0');
  if (/[a-f]/.test(hex)) return 'none';
  return formatCtcssHz(Number.parseInt(hex, 10) / 10);
}

/** Bits 0-1 are TS1, bits 2-3 are TS2. 0 off, 2 text, 3 text and APRS. 1 is APRS only. */
function readTalkerAlias(flag: number, timeslot: DMRTimeSlot): SendTalkerAliasOverride {
  const field = timeslot === 2 ? (flag >> 2) & 0x03 : flag & 0x03;
  if (field === 0) return 'off';
  if (field === 2 || field === 3) return 'on';
  return 'default';
}

function readFrequency(bytes: Uint8Array, offset: number): number | null {
  const word =
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0;
  if (word === 0) return null;
  const hex = word.toString(16).padStart(8, '0');
  if (/[a-f]/.test(hex)) return null;
  return Number.parseInt(hex, 10) * 10;
}

function readBcd(bytes: Uint8Array, offset: number, byteLength: number): number | null {
  let digits = '';
  for (let i = 0; i < byteLength; i++) {
    const byte = bytes[offset + i] ?? 0xff;
    const hi = byte >> 4;
    const lo = byte & 0x0f;
    if (hi > 9 || lo > 9) return null;
    digits += `${hi}${lo}`;
  }
  return Number.parseInt(digits, 10);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) {
    const byte = bytes[offset + i] ?? 0xff;
    if (byte === 0xff || byte === 0x00) break;
    if (byte >= 0x20 && byte <= 0x7e) text += String.fromCharCode(byte);
  }
  return text;
}

function readU16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function bitmapBit(bytes: Uint8Array, bitmap: number, bitIndex: number): boolean {
  const at = bitmap + (bitIndex >> 3);
  return ((bytes[at] ?? 0) & (1 << (bitIndex & 7))) !== 0;
}
