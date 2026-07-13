import type { PersistableRow } from './revision.ts';
import type {
  AprsPositionSource,
  AprsPttMode,
  AprsReportType,
  AprsSlotCallType,
  DMRTimeSlot,
  EntityRef,
  GeoPoint,
} from './libraryTypes.ts';

/**
 * One digital (DMR) APRS channel slot in the global config.
 * Slot cardinality caps are enforced at export, not in library CRUD.
 */
export interface AprsChannelSlot {
  /** Library channel this slot transmits APRS on. `null` = current channel at export. */
  channelRef: EntityRef | null;
  timeslot: DMRTimeSlot | null;
  /** Target DMR ID (talkgroup or private ID). Need NOT exist as a library contact. */
  targetDmrId: number | null;
  callType: AprsSlotCallType;
}

export interface AprsConfiguration extends PersistableRow {
  name: string;
  comment: string;

  manualTxIntervalSec: number | null;
  autoTxIntervalSec: number | null;

  positionSource: AprsPositionSource;
  /** Used when `positionSource === 'fixed'`. */
  fixedLocation: GeoPoint | null;

  channelSlots: AprsChannelSlot[];
}

export interface ChannelAprsBinding {
  /** Digital channels only in UI. */
  receiveEnabled: boolean;

  /** `off` | `digital` only. Never `analog` in our model. */
  reportType: AprsReportType;

  digitalPttMode: AprsPttMode;

  /**
   * 1-based index into `AprsConfiguration.channelSlots` for position reports.
   * `null` = unset.
   */
  reportSlotIndex: number | null;
}
