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
 * One digital (DMR) APRS channel slot in the global config (Anytone ×8;
 * cardinality enforced at export, not CRUD).
 */
export interface AprsChannelSlot {
  /** Library channel this slot transmits APRS on. `null` = current channel (Anytone wire `0`). */
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
  /** Used when `positionSource === 'fixed'`. CPS exports only the selected fixed beacon. */
  fixedLocation: GeoPoint | null;

  channelSlots: AprsChannelSlot[];
  /** Global default target (Anytone `APRS TG`) — raw DMR ID. */
  defaultDmrId: number | null;
  defaultCallType: AprsSlotCallType;
}

export interface ChannelAprsBinding {
  /** Anytone `APRS RX` / DM32 `APRS Receive`. Digital channels only in UI. */
  receiveEnabled: boolean;

  /** `off` | `digital` only. Never `analog` in our model. */
  reportType: AprsReportType;

  /** Anytone `Digital APRS PTT Mode`: off | on. */
  digitalPttMode: AprsPttMode;

  /**
   * Anytone `Digital APRS Report Channel` / DM32 `APRS Report Channel`.
   * References a library channel; at export we resolve to the 1-based index of the
   * matching slot in the active `AprsConfiguration.channelSlots`.
   */
  reportChannelRef: EntityRef | null;
}
