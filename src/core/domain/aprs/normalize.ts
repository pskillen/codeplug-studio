import type { AprsChannelSlot, AprsConfiguration, ChannelAprsBinding } from '@core/models/aprs.ts';
import type {
  AprsPositionSource,
  AprsPttMode,
  AprsReportType,
  AprsSlotCallType,
  DMRTimeSlot,
  EntityRef,
} from '@core/models/libraryTypes.ts';
import { CHANNEL_APRS_OFF } from './defaults.ts';

const REPORT_TYPES = new Set<AprsReportType>(['off', 'digital']);
const PTT_MODES = new Set<AprsPttMode>(['off', 'on']);
const SLOT_CALL_TYPES = new Set<AprsSlotCallType>(['private', 'group']);
const POSITION_SOURCES = new Set<AprsPositionSource>([
  'fixed',
  'gps',
  'beidou',
  'galileo',
  'allGnss',
]);
const TIMESLOTS = new Set<DMRTimeSlot>([1, 2]);

export interface AprsNormalizeWarning {
  code: 'analog_report_type_mapped_off';
  message: string;
}

function normalizeChannelRef(ref: EntityRef | null | undefined): EntityRef | null {
  if (ref == null) return null;
  if (ref.kind !== 'channel') return null;
  const id = ref.id.trim();
  return id ? { kind: 'channel', id } : null;
}

function normalizePositiveIntOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.trunc(value);
  return n > 0 ? n : null;
}

function normalizeReportType(
  value: AprsReportType | 'analog' | string | null | undefined,
  warnings: AprsNormalizeWarning[],
): AprsReportType {
  if (value == null || value === '' || value === 'off') return 'off';
  if (value === 'digital') return 'digital';
  if (typeof value === 'string' && value.toLowerCase() === 'analog') {
    warnings.push({
      code: 'analog_report_type_mapped_off',
      message: 'Wire Analog APRS report type is not supported — normalized to off',
    });
    return 'off';
  }
  return REPORT_TYPES.has(value as AprsReportType) ? (value as AprsReportType) : 'off';
}

function normalizePttMode(value: AprsPttMode | string | null | undefined): AprsPttMode {
  if (value == null) return 'off';
  return PTT_MODES.has(value as AprsPttMode) ? (value as AprsPttMode) : 'off';
}

function normalizeSlotCallType(value: AprsSlotCallType | null | undefined): AprsSlotCallType {
  if (value == null) return 'group';
  return SLOT_CALL_TYPES.has(value) ? value : 'group';
}

function normalizePositionSource(value: AprsPositionSource | null | undefined): AprsPositionSource {
  if (value == null) return 'allGnss';
  return POSITION_SOURCES.has(value) ? value : 'allGnss';
}

function normalizeTimeslot(value: DMRTimeSlot | null | undefined): DMRTimeSlot | null {
  if (value == null) return null;
  return TIMESLOTS.has(value) ? value : null;
}

function normalizeReportSlotIndex(
  value: number | null | undefined,
  maxSlots: number,
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const index = Math.trunc(value);
  if (index < 1) return null;
  if (maxSlots === 0) return index;
  if (index > maxSlots) return null;
  return index;
}

export function normalizeAprsChannelSlot(slot: AprsChannelSlot): AprsChannelSlot {
  return {
    channelRef: normalizeChannelRef(slot.channelRef),
    timeslot: normalizeTimeslot(slot.timeslot),
    targetDmrId: normalizePositiveIntOrNull(slot.targetDmrId),
    callType: normalizeSlotCallType(slot.callType),
  };
}

export function normalizeChannelAprsBinding(
  binding: ChannelAprsBinding | null | undefined,
  warnings: AprsNormalizeWarning[] = [],
  maxSlots = 0,
): ChannelAprsBinding | undefined {
  if (binding == null) return undefined;
  const normalized: ChannelAprsBinding = {
    receiveEnabled: Boolean(binding.receiveEnabled),
    reportType: normalizeReportType(binding.reportType, warnings),
    digitalPttMode: normalizePttMode(binding.digitalPttMode),
    reportSlotIndex: normalizeReportSlotIndex(binding.reportSlotIndex, maxSlots),
  };
  if (
    normalized.receiveEnabled === CHANNEL_APRS_OFF.receiveEnabled &&
    normalized.reportType === CHANNEL_APRS_OFF.reportType &&
    normalized.digitalPttMode === CHANNEL_APRS_OFF.digitalPttMode &&
    normalized.reportSlotIndex == null
  ) {
    return undefined;
  }
  return normalized;
}

export function normalizeOptionalChannelAprs(
  binding: ChannelAprsBinding | null | undefined,
  warnings: AprsNormalizeWarning[] = [],
  maxSlots = 0,
): ChannelAprsBinding | undefined {
  return normalizeChannelAprsBinding(binding, warnings, maxSlots);
}

export function normalizeAprsConfiguration(config: AprsConfiguration): AprsConfiguration {
  const channelSlots = (config.channelSlots ?? []).map(normalizeAprsChannelSlot);
  return {
    ...config,
    name: config.name.trim(),
    comment: config.comment.trim(),
    manualTxIntervalSec: normalizePositiveIntOrNull(config.manualTxIntervalSec),
    autoTxIntervalSec: normalizePositiveIntOrNull(config.autoTxIntervalSec),
    positionSource: normalizePositionSource(config.positionSource),
    fixedLocation: config.fixedLocation,
    channelSlots,
  };
}

export function normalizeAprsConfigurationOrNull(
  config: AprsConfiguration | null | undefined,
): AprsConfiguration | null {
  if (config == null) return null;
  return normalizeAprsConfiguration(config);
}
