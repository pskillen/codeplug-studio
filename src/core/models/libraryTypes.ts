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
