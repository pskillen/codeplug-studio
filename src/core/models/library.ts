import type { PersistableRow } from './revision.ts';
import type {
  AnalogChannelMode,
  ChannelTone,
  DigitalChannelMode,
  DMRTimeSlot,
  EntityRef,
  GeoPoint,
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
} from './libraryTypes.ts';

export type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';

export interface ChannelModeProfileAnalog {
  mode: AnalogChannelMode;
  squelch: number | null;
  rxTone: ChannelTone;
  txTone: ChannelTone;
  bandwidthKHz: number | null;
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
  scanSkip: boolean;
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

export interface ZoneMemberEntry {
  channelId: string;
  /** When false, channel stays in zone but is omitted from derived scan lists. Default true. */
  includeInScanList?: boolean;
}

export interface Zone extends PersistableRow {
  name: string;
  members: ZoneMemberEntry[];
  comment: string;
}

export interface Library {
  channels: Channel[];
  analogContacts: AnalogContact[];
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  rxGroupLists: RxGroupList[];
  zones: Zone[];
}
