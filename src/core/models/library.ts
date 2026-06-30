import type { PersistableRow } from './revision.ts';
import type {
  ChannelMode,
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

export interface AbstractChannelModeProfile {
  mode: ChannelMode;
}

export interface ChannelModeProfileFM extends AbstractChannelModeProfile {
  mode: 'fm' | 'am' | 'ssb-usb' | 'ssb-lsb';
  squelch: number | null;
  rxTone: ChannelTone;
  txTone: ChannelTone;
}

export interface ChannelModeProfileDMR extends AbstractChannelModeProfile {
  mode: 'dmr';
  colourCode: number | null;
  timeslot: DMRTimeSlot | null;
  dmrId: number | null;
  contactRef: EntityRef | null;
  rxGroupListId: string | null;
}

export interface Channel extends PersistableRow {
  name: string;
  callsign: string;
  rxFrequency: number | null;
  txFrequency: number | null;
  location: GeoPoint | null;
  useLocation: boolean;
  power: number | null;
  scanSkip: boolean;
  comment: string;
}

export interface TalkGroup extends PersistableRow {
  mode: DigitalChannelMode;
  name: string;
  digitalId: number;
  comment: string;
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
}

export interface RxGroupList extends PersistableRow {
  name: string;
  members: RxGroupListMember[];
}

export interface Zone extends PersistableRow {
  name: string;
  members: EntityRef[];
  exportScratchChannel: boolean;
  exportScanList: boolean;
  scanCarrierFrequencyHz: number | null;
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
