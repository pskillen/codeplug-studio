import type { PersistableRow } from './revision.ts';
import type {
  AnalogChannelMode,
  ChannelTone,
  DigitalChannelMode,
  DMRTimeSlot,
  EntityRef,
  GeoPoint,
  SsbSideband,
} from './libraryTypes.ts';

export type {
  ChannelMode,
  ChannelTone,
  EntityRef,
  GeoPoint,
  DMRTimeSlot,
  EntityRefKind,
  AnalogChannelMode,
  DigitalChannelMode,
  SsbSideband,
} from './libraryTypes.ts';

export type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';

/** Per-channel scan participation at export — resolved against build + format defaults when `default`. */
export type ScanInclusion = 'default' | 'skip' | 'alwaysScan';

export interface ChannelModeProfileAnalog {
  mode: AnalogChannelMode;
  squelch: number | null;
  rxTone: ChannelTone;
  txTone: ChannelTone;
  bandwidthKHz: number | null;
  /** USB vs LSB when `mode === 'ssb'`; defaults to `usb` when omitted. */
  ssbSideband?: SsbSideband;
}

export interface ChannelModeProfileDMR {
  mode: 'dmr';
  colourCode: number | null;
  timeslot: DMRTimeSlot | null;
  dmrId: number | null;
  contactRef: EntityRef | null;
  rxGroupListId: string | null;
}

export interface ChannelModeProfileDstar {
  mode: 'dstar';
  urCall: string;
  rpt1Call: string;
  rpt2Call: string;
}

export interface ChannelModeProfileYsf {
  mode: 'ysf';
  dgId: number | null;
  wiresDtmfId: string;
}

export interface ChannelModeProfileNxdn {
  mode: 'nxdn';
  rxRan: number | null;
  txRan: number | null;
  unitId: number | null;
  talkGroupRef: EntityRef | null;
}

export interface ChannelModeProfileTetra {
  mode: 'tetra';
  mcc: number | null;
  mnc: number | null;
  gssi: number | null;
  colorCode: number | null;
  talkGroupRef: EntityRef | null;
}

export interface ChannelModeProfileStub {
  mode: 'p25' | 'm17';
}

export type ChannelModeProfile =
  | ChannelModeProfileAnalog
  | ChannelModeProfileDMR
  | ChannelModeProfileDstar
  | ChannelModeProfileYsf
  | ChannelModeProfileNxdn
  | ChannelModeProfileTetra
  | ChannelModeProfileStub;

export interface Channel extends PersistableRow {
  name: string;
  callsign: string;
  rxFrequency: number | null;
  txFrequency: number | null;
  location: GeoPoint | null;
  useLocation: boolean;
  /** Maidenhead locator when known — not mutually exclusive with `location`. */
  maidenheadLocator: string | null;
  power: number | null;
  scanInclusion: ScanInclusion;
  /** When true, channel is receive-only (no transmit) at export. */
  forbidTransmit: boolean;
  comment: string;
  modeProfiles: ChannelModeProfile[];
  /** Optional short qualifier tried first when export wire names exceed profile limits. */
  abbreviation?: string;
}

export interface TalkGroup extends PersistableRow {
  mode: DigitalChannelMode;
  name: string;
  digitalId: number;
  comment: string;
  abbreviation?: string;
}

export interface DigitalContact extends PersistableRow {
  mode: DigitalChannelMode;
  name: string;
  digitalId: number;
  comment: string;
}

export interface AnalogContact extends PersistableRow {
  name: string;
  code: string;
  comment: string;
}

export interface RxGroupListMember {
  ref: EntityRef;
  /** Optional DMR slot hint for this member — maps to CPS TS Override at export boundary. */
  timeSlotOverride?: DMRTimeSlot | null;
}

export interface RxGroupList extends PersistableRow {
  name: string;
  members: RxGroupListMember[];
}

export type ZoneMemberEntry =
  | { kind: 'channel'; channelId: string; includeInScanList?: boolean }
  | { kind: 'zone'; zoneId: string };

export interface Zone extends PersistableRow {
  name: string;
  members: ZoneMemberEntry[];
  comment: string;
  /** When true, zone is omitted from Zones.csv but still flattens into parent zones. */
  omitFromExport?: boolean;
}

export interface Library {
  channels: Channel[];
  analogContacts: AnalogContact[];
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  rxGroupLists: RxGroupList[];
  zones: Zone[];
}
