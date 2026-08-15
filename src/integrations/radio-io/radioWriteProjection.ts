/**
 * Radio-boundary Write projection — modelled regions for clone-image encode.
 * App builds this from assemble + m×n expand; radio modules encode only.
 * No library UUIDs on organisation rows (channel numbers / radio indices only).
 */

import type { RadioChannelDto } from './radioChannelDto.ts';
import type { AtD890ResolvedScanListTiming } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';

/** Zone membership as radio channel numbers (1-based). */
export interface RadioZoneDto {
  wireName: string;
  /** Ordered 1-based channel numbers (max 64 on DM-32UV). */
  channelNumbers: readonly number[];
}

/** AT-D890UV AM airband channel (parallel bank — freq + name only). */
export interface RadioAmAirChannelDto {
  /** 1-based AmAir slot (CSV `No.`); wire occupancy is 0-based. */
  slotIndex: number;
  wireName: string;
  rxHz: number;
}

/** AT-D890UV AM airband zone (max 32 members; A-channel = member-list index). */
export interface RadioAmZoneDto {
  wireName: string;
  /** Ordered 1-based AmAir channel numbers. */
  channelNumbers: readonly number[];
  /** Index into `channelNumbers` for the zone A-channel (default 0). */
  aChannelMemberIndex?: number;
  /** Member-list positions included in scan; omit to scan all members. */
  scanMemberIndices?: readonly number[];
}

/** Scan list membership as radio channel numbers (1-based). */
export interface RadioScanListDto {
  wireName: string;
  /** Named members only (max 15 on DM-32UV); implicit current-channel is radio-side. */
  channelNumbers: readonly number[];
  /** 1-based designated TX channel, or omit for “current”. */
  designatedTxChannel?: number;
  /** 1-based scan list id for channel-record FK (1..32). */
  listIndex: number;
}

/** Talk group / quick-contact entry for metadata 0x44. */
export interface RadioTalkGroupDto {
  /** 1-based radio index. */
  index: number;
  wireName: string;
  digitalId: number;
  /** NeonPlug quick-contact call type: 0x03 private, 0x04 group, 0x05 all — Studio DM-32UV Write always uses group (0x04). */
  callType: number;
  /** OpenGD77 contact-bank clone: Force TS1 / TS2 (`0x17` on wire). */
  timeSlotOverride?: 1 | 2;
}

/** RX group list for metadata 0x0F. */
export interface RadioRxGroupDto {
  /** 1-based radio index. */
  index: number;
  wireName: string;
  /**
   * RX member payload (up to 32).
   * - `radio-io-dm32uv`: DMR IDs (24-bit LE on wire).
   * - `radio-io-at-d890uv`: 0-based talkgroup bank slot indices (u32 LE on wire).
   * - `radio-io-opengd77-*`: 1-based DMR contact bank indices when timeslot clones apply.
   */
  memberDigitalIds: readonly number[];
}

/** Digital address-book contact (V-frame 0x0F). */
export interface RadioDigitalContactDto {
  wireName: string;
  digitalId: number;
  callsign: string;
  city: string;
  province: string;
  country: string;
  remark: string;
}

/** Operator DMR radio ID in metadata 0x67 bank. */
export interface RadioRadioIdDto {
  /** 0-based bank index (channel byte 0x2B). */
  index: number;
  dmrId: number;
  /** Up to 11 characters + null on wire. */
  name: string;
}

/** APRS / GPS position slice on settings block (offsets 0x301–0x334). */
export interface RadioAprsDigitalSlotDto {
  /** LE u16 wire: MR CPS channel `No.` or sentinel (e.g. `0x0fa2` Current). */
  reportChannelWire: number;
  targetDmrId: number | null;
  callType: 0 | 1;
  timeslot: 0 | 1 | 2;
}

export interface RadioAprsFixCoordinateDto {
  degrees: number;
  minInt: number;
  minMark: number;
  hemisphere: 0 | 1;
}

/** APRS / GPS position slice on settings block (offsets 0x301–0x334). */
export interface RadioAprsDto {
  /** DM-32 report channel numbers 1–8 (0 = current). */
  reportChannelNumbers?: readonly number[];
  scheduledSendTime?: number;
  manualBeacon?: boolean;
  latitude?: string;
  latitudeHemisphere?: 'N' | 'S';
  longitude?: string;
  longitudeHemisphere?: 'E' | 'W';
  repeaterActiveDelay?: number;
  callType?: number;
  uploadDmrId?: number;
  /** AT-D890UV global APRS block — up to 8 digital report slots. */
  digitalSlots?: readonly RadioAprsDigitalSlotDto[];
  manualTxIntervalSec?: number | null;
  autoTxIntervalSec?: number | null;
  fixedLocationBeacon?: 0 | 1;
  fixedLatitude?: RadioAprsFixCoordinateDto;
  fixedLongitude?: RadioAprsFixCoordinateDto;
}

/**
 * Optional organisation / settings regions merged after (or with) channels.
 * UV-5R Mini ignores this; DM-32UV encodes replaced regions.
 */
export interface RadioWriteOrganisation {
  zones?: readonly RadioZoneDto[];
  scanLists?: readonly RadioScanListDto[];
  talkGroups?: readonly RadioTalkGroupDto[];
  rxGroups?: readonly RadioRxGroupDto[];
  digitalContacts?: readonly RadioDigitalContactDto[];
  /** Operator DMR radio IDs (metadata 0x67) — DM-32UV Web Serial Write. */
  radioIds?: readonly RadioRadioIdDto[];
  aprs?: RadioAprsDto | null;
  /**
   * AT-D890UV AM airband channels. Omit to leave the radio AmAir bank unchanged.
   * When present, `amZones` must also be present (zones ship with channels).
   */
  amAirChannels?: readonly RadioAmAirChannelDto[];
  /**
   * AT-D890UV AM airband zones. Omit (with `amAirChannels`) to retain radio state.
   */
  amZones?: readonly RadioAmZoneDto[];
  /**
   * AT-D890UV scan-list timing deciseconds for all lists when build exportSettings override ([#1069](https://github.com/pskillen/codeplug-studio/issues/1069)).
   */
  /**
   * AT-D890UV scan-list timing deciseconds for all lists when build exportSettings override ([#1069](https://github.com/pskillen/codeplug-studio/issues/1069)).
   */
  atD890ScanListTiming?: AtD890ResolvedScanListTiming['deciseconds'];
  /**
   * OpenGD77 User Database (call-sign DB) rows. Omit to leave FLASH 0x50000 / 0xd8000
   * unchanged. Present (including empty) replaces the lookup store; not the 1024 contact bank.
   */
  userDatabaseContacts?: readonly RadioDigitalContactDto[];
}

/**
 * Full Write projection from assemble → radio encode.
 * `numbersBySourceChannelId` is app-side only (UUID → numbers); not passed to codecs.
 */
export interface RadioWriteProjection {
  channels: readonly RadioChannelDto[];
  organisation: RadioWriteOrganisation;
  /** Library channel UUID → expanded 1-based radio channel numbers. */
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>;
  warnings: string[];
}
