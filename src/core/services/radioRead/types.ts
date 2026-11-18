import type { ChannelTone } from '@core/models/libraryTypes.ts';

/** Radio-neutral decoded tone. */
export type ReadTone =
  | { kind: 'none' }
  | { kind: 'ctcss'; hz: number }
  | { kind: 'dcs'; code: number; polarity?: 'N' | 'I' };

/** The subset of a decoded radio channel used by the mapper. */
export interface ReadChannelInput {
  slotIndex: number;
  empty: boolean;
  wireName: string;
  rxHz: number;
  txHz: number;
  rxTone: ReadTone;
  txTone: ReadTone;
  powerPercent: number | null;
  bandwidth: 'FM' | 'NFM';
  scanAdd?: boolean;
  rxOnly?: boolean;
  analogMode?: 'fm' | 'am';
}

export interface ReadChannelFields {
  rxFrequency: number;
  txFrequency: number;
  power: number | null;
  scanInclusion?: 'alwaysScan' | 'skip';
  forbidTransmit: 'allow' | 'forbid';
  mode: 'fm' | 'am';
  analog: { rxTone: ChannelTone; txTone: ChannelTone; bandwidthKHz: 12.5 | 25 };
}

export interface MappedReadChannel {
  slot: number;
  name: string;
  fields: ReadChannelFields;
}
