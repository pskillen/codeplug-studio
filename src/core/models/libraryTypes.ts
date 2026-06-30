export type EntityRefKind = 'talkGroup' | 'contact';

export interface EntityRef {
  kind: EntityRefKind;
  id: string;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export type ChannelMode = 'fm' | 'dmr' | 'dstar' | 'ysf' | 'p25' | 'nxdn';

export type ChannelTone = 'none' | string;
