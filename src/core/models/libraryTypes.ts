export type EntityRefKind = 'channel' | 'talkGroup' | 'digitalContact' | 'analogContact';

export interface EntityRef {
  kind: EntityRefKind;
  id: string;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export type SsbSideband = 'usb' | 'lsb';
export type AnalogChannelMode = 'fm' | 'am' | 'ssb';
export type DigitalChannelMode = 'dmr' | 'dstar' | 'ysf' | 'p25' | 'nxdn' | 'm17' | 'tetra';
export type ChannelMode = AnalogChannelMode | DigitalChannelMode;

export type ChannelTone = 'none' | string;

export type DMRTimeSlot = 1 | 2;

/** DMR operating mode — vendor-neutral; mapped to CPS wire at export boundary. */
export type DmrOperatingMode = 'dmo-simplex' | 'repeater';

/**
 * Per-channel report selection. Digital APRS only in UI.
 * Wire `Analog` (Anytone) is not supported — import normalizes to `'off'`.
 */
export type AprsReportType = 'off' | 'digital';

/** Digital APRS PTT beacon behaviour — Anytone `Digital APRS PTT Mode`. */
export type AprsPttMode = 'off' | 'on';

/**
 * DMR call type for an APRS slot / global target (Anytone `Call TypeN`).
 * Wire: private = 0, group = 1. (`all call` = 2 exists, DMR-only — deferred.)
 */
export type AprsSlotCallType = 'private' | 'group';

/** Beacon position source for APRS configuration. */
export type AprsPositionSource = 'fixed' | 'gps' | 'beidou' | 'galileo' | 'allGnss';
