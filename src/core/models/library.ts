import type { PersistableRow } from './revision.ts';
import type { ChannelMode, ChannelTone, EntityRef, GeoPoint } from './libraryTypes.ts';

export type {
  ChannelMode,
  ChannelTone,
  EntityRef,
  GeoPoint,
  EntityRefKind,
} from './libraryTypes.ts';

export interface Channel extends PersistableRow {
  name: string;
  callsign: string;
  mode: ChannelMode;
  rxFrequency: number | null;
  txFrequency: number | null;
  contactRef: EntityRef | null;
  rxGroupListId: string | null;
  location: GeoPoint | null;
  useLocation: boolean;
  rxTone: ChannelTone;
  txTone: ChannelTone;
  power: number | null;
  squelch: number | null;
  scanSkip: boolean;
  comment: string;
}

export interface TalkGroup extends PersistableRow {
  name: string;
  dmrId: number;
  colorCode: number | null;
  comment: string;
}

export interface Contact extends PersistableRow {
  name: string;
  dmrId: number;
  comment: string;
}

export interface RxGroupListMember {
  ref: EntityRef;
}

export interface RxGroupList extends PersistableRow {
  name: string;
  members: RxGroupListMember[];
}

export interface Library {
  channels: Channel[];
  talkGroups: TalkGroup[];
  contacts: Contact[];
  rxGroupLists: RxGroupList[];
}
