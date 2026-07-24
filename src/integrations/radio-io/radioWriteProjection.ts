/**
 * Radio-boundary Write projection — modelled regions for clone-image encode.
 * App builds this from assemble + m×n expand; radio modules encode only.
 * No library UUIDs on organisation rows (channel numbers / radio indices only).
 */

import type { RadioChannelDto } from './radioChannelDto.ts';

/** Zone membership as radio channel numbers (1-based). */
export interface RadioZoneDto {
  wireName: string;
  /** Ordered 1-based channel numbers (max 64 on DM-32UV). */
  channelNumbers: readonly number[];
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
  /** Call type: 0 private, 1 group, 2 all-call — NeonPlug quick-contact flag. */
  callType: number;
}

/** RX group list for metadata 0x0F. */
export interface RadioRxGroupDto {
  /** 1-based radio index. */
  index: number;
  wireName: string;
  /** Member DMR IDs (up to 32). */
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

/** APRS / GPS position slice on settings block (offsets 0x301–0x334). */
export interface RadioAprsDto {
  /** Report channel numbers 1–8 (0 = current). */
  reportChannelNumbers: readonly number[];
  scheduledSendTime?: number;
  manualBeacon?: boolean;
  latitude?: string;
  latitudeHemisphere?: 'N' | 'S';
  longitude?: string;
  longitudeHemisphere?: 'E' | 'W';
  repeaterActiveDelay?: number;
  callType?: number;
  uploadDmrId?: number;
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
  aprs?: RadioAprsDto | null;
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
