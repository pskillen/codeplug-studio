/**
 * Project an assembled build into a headerless open-firmware codeplug image.
 * Bytes outside the records written here stay 0xFF, except the zone table, which
 * is zeroed so slot 0 cannot be read as the 16-channel layout.
 */

import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  resolveEffectiveForbidTransmit,
  resolveEffectiveSendTalkerAlias,
} from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import { resolveChannelScanInclusionForExport } from '@core/import-export/scanInclusion/resolve.ts';
import { resolveDmrOperatingMode } from '@core/domain/dmrOperatingMode.ts';
import type { AssembledBuild, AssembledChannel, AssembledZone } from '@core/services/assemble.ts';
import type {
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  OwnDigitalId,
} from '@core/models/library.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  ALL_CALL_DMR_ID,
  CHANNEL_RECORD_SIZE,
  CHANNELS_PER_BANK,
  CONTACT_BASE,
  CONTACT_RECORD_SIZE,
  GENERAL_SETTINGS,
  PER_CHANNEL_DMR_ID_MAX,
  RADIOFOUNDRY_IMAGE_SIZE,
  RX_LIST_BASE,
  RX_LIST_LENGTH,
  RX_LIST_LENGTH_SIZE,
  RX_LIST_RECORD_SIZE,
  SQUELCH_LEVEL_MAX,
  UHF_MAX_HZ,
  UHF_MIN_HZ,
  VHF_MAX_HZ,
  VHF_MIN_HZ,
  ZONE_BITMAP,
  ZONE_BITMAP_SIZE,
  ZONE_RECORD_SIZE,
  channelSlotAddress,
} from './layout.ts';

const LIMITS = DM32UV_RADIOFOUNDRY_LIMITS;

export class RadioFoundryExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadioFoundryExportError';
  }
}

export interface RadioFoundryImage {
  bytes: Uint8Array;
  /**
   * 1 where this serialiser stored a byte, 0 where the image is still the
   * initial 0xFF hole. A cable write may replace only the owned addresses.
   */
  owned: Uint8Array;
  warnings: ExportWarning[];
}

type KeptMode = 'fm' | 'dmr';

function asKeptMode(mode: string): KeptMode | null {
  if (mode === 'fm' || mode === 'dmr') return mode;
  return null;
}

interface KeptChannel {
  row: AssembledChannel;
  mode: KeptMode;
  /** 1-based channel number in the image. */
  number: number;
}

/** Null power is the radio default (byte 0). Otherwise percent 1-100 maps onto levels 1-9. */
export function radioFoundryPowerByte(percent: number | null): number {
  if (percent == null || !Number.isFinite(percent) || percent <= 0) return 0;
  const clamped = Math.min(100, percent);
  const index = Math.min(
    LIMITS.POWER_LEVELS - 1,
    Math.floor(((clamped - 1) * LIMITS.POWER_LEVELS) / 100),
  );
  return index + 1;
}

function markOwned(owned: Uint8Array, offset: number, length: number): void {
  owned.fill(1, offset, offset + length);
}

function releaseOwned(owned: Uint8Array, offset: number, length: number): void {
  owned.fill(0, offset, offset + length);
}

export function serialiseRadioFoundryCodeplug(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): RadioFoundryImage {
  const warnings: ExportWarning[] = [];
  const radio = requireDefaultDmrId(assembled.ownDigitalIds);
  const image = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);
  image.fill(0xff);
  const owned = new Uint8Array(RADIOFOUNDRY_IMAGE_SIZE);

  writeRadioIdentity(image, owned, radio, warnings);
  const contacts = writeContacts(image, owned, assembled, warnings);
  writeRxLists(image, owned, assembled, contacts, warnings);
  const channels = writeChannels(image, owned, assembled, radio, contacts, warnings, options);
  writeZones(image, owned, assembled, channels, warnings);
  warnScanLists(assembled, warnings);

  return { bytes: image, owned, warnings };
}

function requireDefaultDmrId(ids: readonly OwnDigitalId[] | undefined): OwnDigitalId {
  const chosen = (ids ?? []).find((row) => row.protocol === 'dmr' && row.isDefault);
  if (!chosen) {
    throw new RadioFoundryExportError(
      `RadioFoundry export needs a default DMR radio ID from 1 to ${LIMITS.DMR_ID_MAX}.`,
    );
  }
  if (!Number.isInteger(chosen.number) || chosen.number < 1 || chosen.number > LIMITS.DMR_ID_MAX) {
    throw new RadioFoundryExportError(
      `RadioFoundry export refused radio ID ${chosen.number}: it must be from 1 to ${LIMITS.DMR_ID_MAX}.`,
    );
  }
  return chosen;
}

function writeRadioIdentity(
  image: Uint8Array,
  owned: Uint8Array,
  radio: OwnDigitalId,
  warnings: ExportWarning[],
): void {
  markOwned(owned, GENERAL_SETTINGS, LIMITS.RADIO_NAME_MAX + 4);
  writeAsciiField(
    image,
    GENERAL_SETTINGS,
    radio.name,
    LIMITS.RADIO_NAME_MAX,
    'Radio name',
    warnings,
  );
  writeBcdBigEndian(image, GENERAL_SETTINGS + 8, radio.number, 4);
}

function writeChannels(
  image: Uint8Array,
  owned: Uint8Array,
  assembled: AssembledBuild,
  radio: OwnDigitalId,
  contacts: Map<string, number>,
  warnings: ExportWarning[],
  options: CpsExportOptions | undefined,
): Map<string, number> {
  zeroChannelBitmaps(image, owned);
  const pending: Array<{ row: AssembledChannel; mode: KeptMode }> = [];
  for (const row of assembled.channels) {
    const mode = selectMode(row, warnings);
    if (!mode) continue;
    pending.push({ row, mode });
  }
  if (pending.length > LIMITS.CHANNEL_MAX) {
    const dropped = pending.length - LIMITS.CHANNEL_MAX;
    pushGeneralWarning(
      warnings,
      `Dropped ${dropped} channel(s) past the ${LIMITS.CHANNEL_MAX} channel limit.`,
    );
    pending.length = LIMITS.CHANNEL_MAX;
  }

  const numbers = new Map<string, number>();
  for (const item of pending) {
    const channel: KeptChannel = { ...item, number: numbers.size + 1 };
    numbers.set(channel.row.entity.id, channel.number);
    writeChannelRecord(image, owned, channel, assembled, radio, contacts, warnings, options);
    markInUse(image, channel.number);
  }
  return numbers;
}

function selectMode(row: AssembledChannel, warnings: ExportWarning[]): KeptMode | null {
  const channel = row.entity;
  const label = row.wireName || channel.name;
  const supported = channel.modeProfiles.filter(
    (profile): profile is ChannelModeProfileAnalog | ChannelModeProfileDMR =>
      profile.mode === 'fm' || profile.mode === 'dmr',
  );
  if (supported.length === 0) {
    pushGeneralWarning(
      warnings,
      `Channel "${label}" was dropped. This codeplug stores FM and DMR only.`,
    );
    return null;
  }
  for (const profile of channel.modeProfiles) {
    if (profile.mode === 'fm' || profile.mode === 'dmr') continue;
    pushGeneralWarning(
      warnings,
      `Channel "${label}" mode ${profile.mode} was dropped. This codeplug stores FM and DMR only.`,
    );
  }
  if (supported.length === 1) return asKeptMode(supported[0]!.mode);
  let kept: KeptMode = 'dmr';
  if (channel.primaryMode === 'fm') kept = 'fm';
  pushGeneralWarning(
    warnings,
    `Channel "${label}" has more than one mode; kept ${kept === 'dmr' ? 'DMR' : 'FM'}.`,
  );
  return kept;
}

function writeChannelRecord(
  image: Uint8Array,
  owned: Uint8Array,
  channel: KeptChannel,
  assembled: AssembledBuild,
  radio: OwnDigitalId,
  contacts: Map<string, number>,
  warnings: ExportWarning[],
  options: CpsExportOptions | undefined,
): void {
  const { row, mode } = channel;
  const entity = row.entity;
  const label = row.wireName || entity.name;
  const slot = channelSlotAddress(channel.number);
  markOwned(owned, slot.record, CHANNEL_RECORD_SIZE);
  releaseOwned(owned, slot.record + 0x1b, 1);
  releaseOwned(owned, slot.record + 0x25, 1);
  releaseOwned(owned, slot.record + 0x2a, 1);
  const record = image.subarray(slot.record, slot.record + CHANNEL_RECORD_SIZE);
  record.fill(0);
  writeAsciiField(record, 0, row.wireName || entity.name, LIMITS.NAME_MAX, 'Channel', warnings);
  writeFrequency(record, 0x10, entity.rxFrequency, label, 'RX', warnings);
  writeFrequency(record, 0x14, entity.txFrequency ?? entity.rxFrequency, label, 'TX', warnings);
  record[0x18] = mode === 'dmr' ? 1 : 0;
  record[0x19] = radioFoundryPowerByte(entity.power);
  record[0x1b] = 0;
  record[0x20] = 0xff;
  record[0x21] = 0xff;
  record[0x22] = 0xff;
  record[0x23] = 0xff;
  record[0x26] = 0;
  record[0x27] = 0x00;
  record[0x28] = 0x16;
  record[0x29] = 0x00;
  record[0x33] = 0;
  record[0x37] = 0;

  const profile = entity.modeProfiles.find((item) => item.mode === mode);
  if (profile?.mode === 'fm') {
    writeAnalogChannel(record, profile, label, warnings);
  } else if (profile?.mode === 'dmr') {
    writeDmrChannel(record, profile, label, entity, assembled, radio, contacts, warnings, options);
  }
  writeSharedChannelFields(record, channel, options);
}

function writeAnalogChannel(
  record: Uint8Array,
  profile: ChannelModeProfileAnalog,
  label: string,
  warnings: ExportWarning[],
): void {
  record[0x37] = squelchByte(profile.squelch);
  writeBandwidth(record, profile.bandwidthKHz, label, warnings);
  writeTone(record, 0x20, profile.rxTone, 'RX', label, warnings);
  writeTone(record, 0x22, profile.txTone, 'TX', label, warnings);
}

function writeSharedChannelFields(
  record: Uint8Array,
  channel: KeptChannel,
  options: CpsExportOptions | undefined,
): void {
  const entity = channel.row.entity;
  if (resolveEffectiveForbidTransmit(entity, options?.channelBehaviourContext) === 'forbid') {
    record[0x33] |= 0x04;
  }
  const scan = resolveChannelScanInclusionForExport(entity, channel.row.scanInclusionOverride, {
    buildDefault: options?.defaultScanInclusion,
    formatDefault: 'scan',
  });
  if (scan === 'skip') record[0x33] |= 0x30;
  if (!entity.useLocation || entity.location == null) return;
  const lat = encodeCoordinate(entity.location.lat);
  const lon = encodeCoordinate(entity.location.lon);
  record[0x1a] = lat & 0xff;
  record[0x1c] = (lat >> 8) & 0xff;
  record[0x1d] = (lat >> 16) & 0xff;
  record[0x1e] = lon & 0xff;
  record[0x1f] = (lon >> 8) & 0xff;
  record[0x24] = (lon >> 16) & 0xff;
  record[0x26] |= 0x08;
}

/** 24-bit fixed coordinate: sign, whole degrees, then 1/10000 degree. */
function encodeCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const sign = value < 0 ? 0x800000 : 0;
  const abs = Math.abs(value);
  const degrees = Math.min(255, Math.floor(abs));
  const fraction = Math.min(9999, Math.round((abs - degrees) * 10000));
  return sign | (degrees << 15) | fraction;
}

function writeDmrChannel(
  record: Uint8Array,
  profile: ChannelModeProfileDMR,
  label: string,
  entity: KeptChannel['row']['entity'],
  assembled: AssembledBuild,
  radio: OwnDigitalId,
  contacts: Map<string, number>,
  warnings: ExportWarning[],
  options: CpsExportOptions | undefined,
): void {
  const color = profile.colourCode ?? 0;
  const storedColor = color >= 0 && color <= 15 ? color : 0;
  record[0x2c] = storedColor;
  if (color < 0 || color > 15) {
    pushGeneralWarning(
      warnings,
      `Channel "${label}" color code ${color} is outside 0-15 and was written as ${storedColor}.`,
    );
  }
  if (profile.timeslot === 2) record[0x31] = 0x40;
  if (resolveDmrOperatingMode(entity) === 'dmo-simplex') record[0x26] |= 0x04;
  if (resolveEffectiveSendTalkerAlias(profile, options?.channelBehaviourContext) === 'on') {
    record[0x30] |= profile.timeslot === 2 ? 0x08 : 0x02;
  }
  const contact =
    profile.contactRef == null ? 0 : (contacts.get(contactKey(profile.contactRef)) ?? 0);
  record[0x2e] = contact & 0xff;
  record[0x2f] = (contact >> 8) & 0xff;
  const rxList = rxListIndex(assembled, profile.rxGroupListId);
  record[0x2b] = rxList;
  writeOwnIdOverride(record, profile, assembled.ownDigitalIds ?? [], radio, label, warnings);
}

function writeOwnIdOverride(
  record: Uint8Array,
  profile: ChannelModeProfileDMR,
  ids: readonly OwnDigitalId[],
  radio: OwnDigitalId,
  label: string,
  warnings: ExportWarning[],
): void {
  if (!profile.ownDigitalIdId || profile.ownDigitalIdId === radio.id) return;
  const other = ids.find((row) => row.id === profile.ownDigitalIdId);
  if (
    !other ||
    other.protocol !== 'dmr' ||
    !Number.isInteger(other.number) ||
    other.number < 0 ||
    other.number > PER_CHANNEL_DMR_ID_MAX
  ) {
    pushGeneralWarning(
      warnings,
      `Channel "${label}" points at an own ID that cannot be stored as a per-channel override.`,
    );
    return;
  }
  record[0x26] |= 0x80;
  record[0x27] = (other.number >> 16) & 0xff;
  record[0x28] = (other.number >> 8) & 0xff;
  record[0x29] = other.number & 0xff;
}

function writeBandwidth(
  record: Uint8Array,
  bandwidthKHz: number | null,
  label: string,
  warnings: ExportWarning[],
): void {
  if (bandwidthKHz === 25) {
    record[0x33] |= 0x02;
    return;
  }
  if (bandwidthKHz != null && bandwidthKHz !== 12.5) {
    pushGeneralWarning(
      warnings,
      `Channel "${label}" bandwidth ${bandwidthKHz} kHz was written as 12.5 kHz.`,
    );
  }
}

function writeFrequency(
  record: Uint8Array,
  offset: number,
  hz: number | null,
  label: string,
  which: 'RX' | 'TX',
  warnings: ExportWarning[],
): void {
  if (hz == null || !Number.isFinite(hz)) {
    pushGeneralWarning(warnings, `Channel "${label}" has no ${which} frequency; wrote 0 Hz.`);
    return;
  }
  if (!inBand(hz)) {
    const mhz = (hz / 1_000_000).toFixed(5);
    pushGeneralWarning(
      warnings,
      `Channel "${label}" ${which} frequency ${mhz} MHz is outside 136-174 and 400-480 MHz.`,
    );
  }
  const units = Math.round(hz / 10);
  if (units < 0 || units > 99_999_999) {
    pushGeneralWarning(
      warnings,
      `Channel "${label}" ${which} frequency does not fit in 8 BCD digits; wrote 0 Hz.`,
    );
    return;
  }
  const digits = units.toString(10).padStart(8, '0');
  const word = Number.parseInt(digits, 16);
  record[offset] = word & 0xff;
  record[offset + 1] = (word >> 8) & 0xff;
  record[offset + 2] = (word >> 16) & 0xff;
  record[offset + 3] = (word >>> 24) & 0xff;
}

function inBand(hz: number): boolean {
  return (hz >= VHF_MIN_HZ && hz <= VHF_MAX_HZ) || (hz >= UHF_MIN_HZ && hz <= UHF_MAX_HZ);
}

/**
 * Open-firmware tone word. 0xFFFF is none. CTCSS is BCD tenths of Hz
 * (88.5 Hz is 0x0885). DCS sets bit 15, bit 14 when inverted, and stores the
 * octal digits as hex digits (D023N is 0x8023, D023I is 0xC023).
 */
function writeTone(
  record: Uint8Array,
  offset: number,
  tone: string,
  which: 'RX' | 'TX',
  label: string,
  warnings: ExportWarning[],
): void {
  const word = toneWord(tone);
  if (word == null) {
    pushGeneralWarning(
      warnings,
      `Channel "${label}" ${which} tone ${tone} cannot be stored and was written as none.`,
    );
    record[offset] = 0xff;
    record[offset + 1] = 0xff;
    return;
  }
  record[offset] = word & 0xff;
  record[offset + 1] = (word >> 8) & 0xff;
}

function toneWord(tone: string): number | null {
  const text = tone.trim();
  if (!text || text === '—' || text.toLowerCase() === 'none') return 0xffff;
  const dcs = /^D(\d{1,3})([NPI]?)$/i.exec(text);
  if (dcs) {
    const digits = dcs[1]!.padStart(3, '0');
    if ([...digits].some((digit) => digit > '7')) return null;
    const inverted = dcs[2]?.toUpperCase() === 'I' || dcs[2]?.toUpperCase() === 'P';
    return Number.parseInt(digits, 16) | 0x8000 | (inverted ? 0x4000 : 0);
  }
  const hz = Number.parseFloat(text);
  if (!Number.isFinite(hz) || hz <= 0) return null;
  const tenths = Math.round(hz * 10);
  if (tenths < 300 || tenths > 3000) return null;
  const bcd = tenths.toString(10).padStart(4, '0');
  if (bcd.length > 4) return null;
  return Number.parseInt(bcd, 16);
}

function squelchByte(percent: number | null): number {
  if (percent == null || !Number.isFinite(percent)) return 0;
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round((clamped * SQUELCH_LEVEL_MAX) / 100);
}

interface WireContact {
  key: string;
  name: string;
  digitalId: number;
  callType: number;
}

function writeContacts(
  image: Uint8Array,
  owned: Uint8Array,
  assembled: AssembledBuild,
  warnings: ExportWarning[],
): Map<string, number> {
  const contacts = collectContacts(assembled, warnings);
  if (contacts.length > LIMITS.CONTACTS_MAX) {
    const dropped = contacts.length - LIMITS.CONTACTS_MAX;
    pushGeneralWarning(
      warnings,
      `Dropped ${dropped} contact(s) past the ${LIMITS.CONTACTS_MAX} contact limit. Talk groups and private contacts share this table.`,
    );
    contacts.length = LIMITS.CONTACTS_MAX;
  }
  const indexByKey = new Map<string, number>();
  contacts.forEach((contact, index) => {
    const number = index + 1;
    indexByKey.set(contact.key, number);
    const offset = CONTACT_BASE + index * CONTACT_RECORD_SIZE;
    markOwned(owned, offset, CONTACT_RECORD_SIZE);
    const record = image.subarray(offset, offset + CONTACT_RECORD_SIZE);
    record.fill(0xff);
    writeAsciiField(record, 0, contact.name, LIMITS.NAME_MAX, 'Contact', warnings);
    writeBcdBigEndian(record, 0x10, contact.digitalId, 4);
    record[0x14] = contact.callType;
    record[0x15] = 0;
    record[0x16] = 0;
    record[0x17] = 0x01;
  });
  return indexByKey;
}

function collectContacts(assembled: AssembledBuild, warnings: ExportWarning[]): WireContact[] {
  const contacts: WireContact[] = [];
  for (const row of assembled.talkGroups) {
    if (row.entity.mode !== 'dmr') {
      pushGeneralWarning(
        warnings,
        `Talk group "${row.wireName}" was dropped because it is not DMR.`,
      );
      continue;
    }
    const callType = row.entity.digitalId === ALL_CALL_DMR_ID ? 2 : 0;
    if (!fitsContactId(row.entity.digitalId)) {
      pushGeneralWarning(
        warnings,
        `Talk group "${row.wireName}" ID ${row.entity.digitalId} was dropped.`,
      );
      continue;
    }
    contacts.push({
      key: contactKey({ kind: 'talkGroup', id: row.entity.id }),
      name: row.wireName,
      digitalId: row.entity.digitalId,
      callType,
    });
  }
  for (const row of assembled.digitalContacts) {
    if (row.entity.mode !== 'dmr') {
      pushGeneralWarning(warnings, `Contact "${row.wireName}" was dropped because it is not DMR.`);
      continue;
    }
    const callType = row.entity.digitalId === ALL_CALL_DMR_ID ? 2 : 1;
    if (!fitsContactId(row.entity.digitalId)) {
      pushGeneralWarning(
        warnings,
        `Contact "${row.wireName}" ID ${row.entity.digitalId} was dropped.`,
      );
      continue;
    }
    contacts.push({
      key: contactKey({ kind: 'digitalContact', id: row.entity.id }),
      name: row.wireName,
      digitalId: row.entity.digitalId,
      callType,
    });
  }
  return contacts;
}

function fitsContactId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id <= ALL_CALL_DMR_ID;
}

function writeRxLists(
  image: Uint8Array,
  owned: Uint8Array,
  assembled: AssembledBuild,
  contactIndexByKey: Map<string, number>,
  warnings: ExportWarning[],
): void {
  image.fill(0, RX_LIST_LENGTH, RX_LIST_LENGTH + RX_LIST_LENGTH_SIZE);
  markOwned(owned, RX_LIST_LENGTH, RX_LIST_LENGTH_SIZE);
  const lists = assembled.rxGroupLists.slice(0, LIMITS.RX_GROUPS_MAX);
  if (assembled.rxGroupLists.length > LIMITS.RX_GROUPS_MAX) {
    const dropped = assembled.rxGroupLists.length - LIMITS.RX_GROUPS_MAX;
    pushGeneralWarning(
      warnings,
      `Dropped ${dropped} RX list(s) past the ${LIMITS.RX_GROUPS_MAX} RX list limit.`,
    );
  }
  lists.forEach((row, index) => {
    const members: number[] = [];
    let skipped = 0;
    let sawTimeslot = false;
    for (const member of row.entity.members) {
      if (member.timeSlotOverride != null) sawTimeslot = true;
      const contact = contactIndexByKey.get(contactKey(member.ref));
      if (contact == null) {
        skipped += 1;
        continue;
      }
      members.push(contact);
    }
    if (skipped > 0) {
      pushGeneralWarning(
        warnings,
        `RX list "${row.wireName}" skipped ${skipped} member(s) that are not in the contact table.`,
      );
    }
    if (sawTimeslot) {
      pushGeneralWarning(
        warnings,
        `RX list "${row.wireName}" member timeslot overrides were not written.`,
      );
    }
    if (members.length > LIMITS.RX_GROUP_MEMBERS_MAX) {
      pushGeneralWarning(
        warnings,
        `RX list "${row.wireName}" was shortened from ${members.length} to ${LIMITS.RX_GROUP_MEMBERS_MAX} members.`,
      );
      members.length = LIMITS.RX_GROUP_MEMBERS_MAX;
    }
    image[RX_LIST_LENGTH + index] = members.length === 0 ? 0 : members.length + 1;
    if (members.length === 0) return;
    const offset = RX_LIST_BASE + index * RX_LIST_RECORD_SIZE;
    markOwned(owned, offset, RX_LIST_RECORD_SIZE);
    const record = image.subarray(offset, offset + RX_LIST_RECORD_SIZE);
    record.fill(0);
    writeAsciiField(record, 0, row.wireName, LIMITS.NAME_MAX, 'RX list', warnings);
    members.forEach((contact, memberIndex) => {
      const at = 16 + memberIndex * 2;
      record[at] = contact & 0xff;
      record[at + 1] = (contact >> 8) & 0xff;
    });
  });
}

function writeZones(
  image: Uint8Array,
  owned: Uint8Array,
  assembled: AssembledBuild,
  channelNumbers: Map<string, number>,
  warnings: ExportWarning[],
): void {
  const zoneBytes = ZONE_BITMAP_SIZE + LIMITS.ZONE_MAX * ZONE_RECORD_SIZE;
  image.fill(0, ZONE_BITMAP, ZONE_BITMAP + zoneBytes);
  markOwned(owned, ZONE_BITMAP, zoneBytes);

  const zones = assembled.zones.slice(0, LIMITS.ZONE_MAX);
  if (assembled.zones.length > LIMITS.ZONE_MAX) {
    const dropped = assembled.zones.length - LIMITS.ZONE_MAX;
    pushGeneralWarning(
      warnings,
      `Dropped ${dropped} zone(s) past the ${LIMITS.ZONE_MAX} zone limit.`,
    );
  }
  zones.forEach((zone, index) => {
    writeZone(image, zone, index, channelNumbers, warnings);
  });
}

function writeZone(
  image: Uint8Array,
  zone: AssembledZone,
  index: number,
  channelNumbers: Map<string, number>,
  warnings: ExportWarning[],
): void {
  image[ZONE_BITMAP + (index >> 3)]! |= 1 << (index & 7);
  const offset = ZONE_BITMAP + ZONE_BITMAP_SIZE + index * ZONE_RECORD_SIZE;
  const record = image.subarray(offset, offset + ZONE_RECORD_SIZE);
  writeAsciiField(record, 0, zone.wireName, LIMITS.NAME_MAX, 'Zone', warnings);
  const members: number[] = [];
  let skipped = 0;
  for (const channelId of zone.memberChannelIds) {
    const number = channelNumbers.get(channelId);
    if (number == null) {
      skipped += 1;
      continue;
    }
    members.push(number);
  }
  if (skipped > 0) {
    pushGeneralWarning(
      warnings,
      `Zone "${zone.wireName}" skipped ${skipped} channel(s) that were not written.`,
    );
  }
  if (members.length > LIMITS.ZONE_MEMBERS_MAX) {
    pushGeneralWarning(
      warnings,
      `Zone "${zone.wireName}" was shortened from ${members.length} to ${LIMITS.ZONE_MEMBERS_MAX} channels.`,
    );
    members.length = LIMITS.ZONE_MEMBERS_MAX;
  }
  members.forEach((number, memberIndex) => {
    const at = 16 + memberIndex * 2;
    record[at] = number & 0xff;
    record[at + 1] = (number >> 8) & 0xff;
  });
}

function warnScanLists(assembled: AssembledBuild, warnings: ExportWarning[]): void {
  for (const list of assembled.scanLists) {
    pushGeneralWarning(
      warnings,
      `Scan list "${list.wireName}" was dropped. This codeplug has no scan-list slot.`,
    );
  }
}

function rxListIndex(assembled: AssembledBuild, id: string | null): number {
  if (!id) return 0;
  const index = assembled.rxGroupLists.findIndex((row) => row.entity.id === id);
  if (index < 0 || index >= LIMITS.RX_GROUPS_MAX) return 0;
  return index + 1;
}

function contactKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

function zeroChannelBitmaps(image: Uint8Array, owned: Uint8Array): void {
  const banks = LIMITS.CHANNEL_MAX / CHANNELS_PER_BANK;
  for (let bank = 0; bank < banks; bank++) {
    const slot = channelSlotAddress(bank * CHANNELS_PER_BANK + 1);
    image.fill(0, slot.bitmap, slot.bitmap + 16);
    markOwned(owned, slot.bitmap, 16);
  }
}

function markInUse(image: Uint8Array, number: number): void {
  const slot = channelSlotAddress(number);
  const at = slot.bitmap + (slot.bitIndex >> 3);
  image[at] = (image[at] ?? 0) | (1 << (slot.bitIndex & 7));
}

function writeBcdBigEndian(
  target: Uint8Array,
  offset: number,
  value: number,
  byteLength: number,
): void {
  const digits = value.toString(10).padStart(byteLength * 2, '0');
  for (let i = 0; i < byteLength; i++) {
    const hi = digits.charCodeAt(i * 2) - 48;
    const lo = digits.charCodeAt(i * 2 + 1) - 48;
    target[offset + i] = (hi << 4) | lo;
  }
}

function writeAsciiField(
  target: Uint8Array,
  offset: number,
  source: string,
  maxLen: number,
  entityKind: string,
  warnings: ExportWarning[],
): void {
  const field = target.subarray(offset, offset + maxLen);
  field.fill(0xff);
  const sanitised = sanitiseAsciiWireString(source);
  if (sanitised !== source) {
    pushGeneralWarning(
      warnings,
      `${entityKind} "${source}" had characters this codeplug cannot store and was written as "${sanitised}".`,
    );
  }
  let text = sanitised;
  if (text.length > maxLen) {
    const exported = text.slice(0, maxLen);
    warnings.push({
      kind: 'wire_name',
      severity: 'problem',
      remediation: 'shortened',
      entityKind,
      original: text,
      exported,
      limit: maxLen,
    });
    text = exported;
  }
  for (let i = 0; i < text.length; i++) field[i] = text.charCodeAt(i);
}
