import type { AprsChannelSlot, AprsConfiguration } from '@core/models/aprs.ts';
import type { AprsPositionSource, AprsSlotCallType, GeoPoint } from '@core/models/libraryTypes.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';

/** NeonPlug report-channel slots are fixed at 8 (radioSettings.aprsReportChannel1…8). */
export const NEONPLUG_APRS_MAX_REPORT_CHANNELS = 8;

/** Combo idx: 0=Off, n = n×30s, max 240 → 7200s. */
export const NEONPLUG_APRS_SCHEDULED_SEND_MAX_IDX = 240;

export const NEONPLUG_APRS_GREENFIELD_WARNING =
  'Library has APRS configuration; NeonPlug greenfield export omits radioSettings — use merge-into-base to write APRS globals to the radio';

/** Keys Studio may overwrite on a donor `radioSettings` bag (shallow leaf patch). */
export type NeonplugAprsRadioSettingsPatch = {
  aprsScheduledSendTime: number;
  aprsFixedBeacon: boolean;
  latitude: string;
  latitudeDirection: 'N' | 'S';
  longitude: string;
  longitudeDirection: 'E' | 'W';
  aprsReportChannel1: number;
  aprsReportChannel2: number;
  aprsReportChannel3: number;
  aprsReportChannel4: number;
  aprsReportChannel5: number;
  aprsReportChannel6: number;
  aprsReportChannel7: number;
  aprsReportChannel8: number;
  aprsCallType: boolean;
  aprsUploadId: number;
  /** Set when position source is GNSS (not fixed). */
  gpsEnabled?: boolean;
  /** 0=GPS, 1=BDS, 2=GPS+BDS — set for GNSS sources. */
  gpsMode?: number;
};

export type NeonplugAprsSettingsBuildResult = {
  /** Null when library has no APRS configuration. */
  patch: NeonplugAprsRadioSettingsPatch | null;
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function slotIsContributing(slot: AprsChannelSlot): boolean {
  return slot.channelRef != null || slot.targetDmrId != null || slot.timeslot != null;
}

/**
 * Encode Studio interval seconds → NeonPlug scheduled-send combo index.
 * `null` / non-finite / ≤0 → Off (0). Otherwise round(s/30) clamped to 1…240.
 */
export function encodeNeonplugAprsScheduledSendTime(seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 0;
  const idx = Math.round(seconds / 30);
  if (idx < 1) return 1;
  if (idx > NEONPLUG_APRS_SCHEDULED_SEND_MAX_IDX) return NEONPLUG_APRS_SCHEDULED_SEND_MAX_IDX;
  return idx;
}

/**
 * Prefer auto interval when set; else manual. Warn when both are set and snap to different combo idx.
 */
export function resolveNeonplugAprsScheduledSendTime(
  config: Pick<AprsConfiguration, 'manualTxIntervalSec' | 'autoTxIntervalSec'>,
  warnings: string[],
): number {
  const auto = config.autoTxIntervalSec;
  const manual = config.manualTxIntervalSec;
  const autoSet = auto != null && Number.isFinite(auto) && auto > 0;
  const manualSet = manual != null && Number.isFinite(manual) && manual > 0;

  if (autoSet && manualSet) {
    const autoIdx = encodeNeonplugAprsScheduledSendTime(auto);
    const manualIdx = encodeNeonplugAprsScheduledSendTime(manual);
    if (autoIdx !== manualIdx) {
      warnings.push(
        `APRS manual (${manual}s) and auto (${auto}s) intervals snap to different NeonPlug scheduled-send values; using auto`,
      );
    }
  }

  if (autoSet) return encodeNeonplugAprsScheduledSendTime(auto);
  if (manualSet) return encodeNeonplugAprsScheduledSendTime(manual);
  return 0;
}

/** Absolute decimal degrees as ≤9-char ASCII (NeonPlug radioSettings latitude/longitude). */
export function formatNeonplugCoordinateAscii(degrees: number): string {
  const abs = Math.abs(degrees);
  if (!Number.isFinite(abs)) return '0';
  for (let decimals = 6; decimals >= 0; decimals--) {
    const s = abs.toFixed(decimals);
    if (s.length <= 9) return s;
  }
  return String(Math.trunc(abs)).slice(0, 9);
}

export function formatNeonplugFixedLocation(location: GeoPoint): {
  latitude: string;
  latitudeDirection: 'N' | 'S';
  longitude: string;
  longitudeDirection: 'E' | 'W';
} {
  return {
    latitude: formatNeonplugCoordinateAscii(location.lat),
    latitudeDirection: location.lat < 0 ? 'S' : 'N',
    longitude: formatNeonplugCoordinateAscii(location.lon),
    longitudeDirection: location.lon < 0 ? 'W' : 'E',
  };
}

/** NeonPlug gpsMode: 0=GPS, 1=BDS, 2=GPS+BDS. Galileo maps to 2 with a warning. */
export function neonplugGpsModeForPositionSource(
  source: AprsPositionSource,
  warnings: string[],
): number | undefined {
  switch (source) {
    case 'fixed':
      return undefined;
    case 'gps':
      return 0;
    case 'beidou':
      return 1;
    case 'galileo':
      warnings.push(
        'APRS position source galileo has no NeonPlug GPS mode; exporting as GPS+BDS (gpsMode 2)',
      );
      return 2;
    case 'allGnss':
      return 2;
    default:
      return undefined;
  }
}

export function resolveNeonplugAprsReportChannelNumber(
  slot: AprsChannelSlot | undefined,
  numbersBySourceChannelId: ReadonlyMap<string, number[]>,
  warnings: string[],
  slotIndex: number,
): number {
  if (!slot || slot.channelRef == null) return 0;
  const numbers = numbersBySourceChannelId.get(slot.channelRef.id);
  if (numbers == null || numbers.length === 0) {
    warnings.push(
      `APRS report channel ${slotIndex} references a channel that is not in this NeonPlug export; using current channel (0)`,
    );
    return 0;
  }
  if (numbers.length > 1) {
    warnings.push(
      `APRS report channel ${slotIndex} source channel expanded to ${numbers.length} NeonPlug rows; using first number ${numbers[0]}`,
    );
  }
  return numbers[0]!;
}

function resolveCallTypeAndUpload(
  config: AprsConfiguration,
  warnings: string[],
): { callType: AprsSlotCallType | null; uploadId: number | null } {
  const contributing = config.channelSlots
    .map((slot, i) => ({ slot, index: i + 1 }))
    .filter(({ slot }) => slotIsContributing(slot));

  const consensusSource = contributing[0]?.slot ?? config.channelSlots[0] ?? null;
  const callType = consensusSource?.callType ?? null;
  const uploadId = consensusSource?.targetDmrId ?? null;

  for (const { slot, index } of contributing.slice(1)) {
    if (slot.callType !== callType) {
      warnings.push(
        `APRS slots disagree on call type (NeonPlug supports one value); using slot 1 — check slot ${index}`,
      );
    }
    if (slot.targetDmrId !== uploadId) {
      warnings.push(
        `APRS slots disagree on upload DMR ID (NeonPlug supports one value); using slot 1 — check slot ${index}`,
      );
    }
  }

  return { callType, uploadId };
}

/**
 * Build a shallow `radioSettings` APRS patch from the library APRS model + export channel numbers.
 * Returns `patch: null` when there is no library APRS configuration.
 */
export function buildNeonplugAprsRadioSettingsPatch(
  assembled: AssembledBuild,
  numbersBySourceChannelId: ReadonlyMap<string, number[]>,
): NeonplugAprsSettingsBuildResult {
  const config = assembled.aprsConfiguration ?? null;
  if (config == null) {
    return { patch: null, warnings: [] };
  }

  const warnings: string[] = [];

  if (config.channelSlots.length > NEONPLUG_APRS_MAX_REPORT_CHANNELS) {
    warnings.push(
      `APRS configuration has ${config.channelSlots.length} channel slots; NeonPlug exports the first ${NEONPLUG_APRS_MAX_REPORT_CHANNELS} only`,
    );
  }

  const channels: number[] = [];
  for (let i = 0; i < NEONPLUG_APRS_MAX_REPORT_CHANNELS; i++) {
    channels.push(
      resolveNeonplugAprsReportChannelNumber(
        config.channelSlots[i],
        numbersBySourceChannelId,
        warnings,
        i + 1,
      ),
    );
  }

  const { callType, uploadId } = resolveCallTypeAndUpload(config, warnings);
  const scheduled = resolveNeonplugAprsScheduledSendTime(config, warnings);

  const patch: NeonplugAprsRadioSettingsPatch = {
    aprsScheduledSendTime: scheduled,
    aprsFixedBeacon: false,
    latitude: '0',
    latitudeDirection: 'N',
    longitude: '0',
    longitudeDirection: 'E',
    aprsReportChannel1: channels[0]!,
    aprsReportChannel2: channels[1]!,
    aprsReportChannel3: channels[2]!,
    aprsReportChannel4: channels[3]!,
    aprsReportChannel5: channels[4]!,
    aprsReportChannel6: channels[5]!,
    aprsReportChannel7: channels[6]!,
    aprsReportChannel8: channels[7]!,
    aprsCallType: callType === 'group',
    aprsUploadId:
      uploadId != null && Number.isFinite(uploadId) && uploadId > 0 ? Math.trunc(uploadId) : 0,
  };

  if (config.positionSource === 'fixed') {
    patch.aprsFixedBeacon = true;
    if (config.fixedLocation) {
      const coords = formatNeonplugFixedLocation(config.fixedLocation);
      Object.assign(patch, coords);
    } else {
      warnings.push('APRS position source is fixed but fixedLocation is unset; beacon on with 0/0');
    }
  } else {
    patch.aprsFixedBeacon = false;
    patch.gpsEnabled = true;
    const gpsMode = neonplugGpsModeForPositionSource(config.positionSource, warnings);
    if (gpsMode != null) patch.gpsMode = gpsMode;
  }

  return { patch, warnings };
}

/**
 * Shallow-merge an APRS patch onto a donor `radioSettings` bag.
 * Returns `null` when donor is null (greenfield — do not invent a settings object).
 * When `patch` is null, returns donor unchanged.
 */
export function applyNeonplugAprsRadioSettingsPatch(
  donorSettings: unknown | null,
  patch: NeonplugAprsRadioSettingsPatch | null,
): unknown | null {
  if (donorSettings == null) return null;
  if (patch == null) return donorSettings;
  if (!isRecord(donorSettings)) {
    return { ...patch };
  }
  return { ...donorSettings, ...patch };
}
