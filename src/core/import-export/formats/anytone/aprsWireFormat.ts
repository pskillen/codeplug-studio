import type {
  AprsPttMode,
  AprsPositionSource,
  AprsReportType,
  AprsSlotCallType,
  DMRTimeSlot,
  GeoPoint,
} from '@core/models/libraryTypes.ts';

export function formatAnytoneAprsOnOff(enabled: boolean): 'On' | 'Off' {
  return enabled ? 'On' : 'Off';
}

export function formatAnytoneAprsReportType(reportType: AprsReportType): 'Off' | 'Digital' {
  return reportType === 'digital' ? 'Digital' : 'Off';
}

export function formatAnytoneAprsPttMode(mode: AprsPttMode): 'On' | 'Off' {
  return mode === 'on' ? 'On' : 'Off';
}

export function formatAnytoneAprsCallType(callType: AprsSlotCallType): '0' | '1' {
  return callType === 'private' ? '0' : '1';
}

export function formatAnytoneAprsTimeslot(timeslot: DMRTimeSlot | null | undefined): string {
  if (timeslot == null) return '0';
  return String(timeslot);
}

export function formatAnytoneAprsIntervalSec(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '0';
  return String(Math.trunc(seconds));
}

const ANYTONE_APRS_AUTO_TX_INTERVAL_MIN_SEC = 60;
const ANYTONE_APRS_AUTO_TX_INTERVAL_MAX_SEC = 3870;
const ANYTONE_APRS_AUTO_TX_INTERVAL_MAX_WIRE = 255;

/** Wire byte code k for auto TX interval (0 = off). */
export function encodeAnytoneAprsAutoTxIntervalSec(seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.trunc(seconds / 15) - 3;
}

/** Seconds from wire byte code k. */
export function decodeAnytoneAprsAutoTxIntervalWire(k: number): number {
  if (!Number.isFinite(k) || k <= 0) return 0;
  return (Math.trunc(k) + 3) * 15;
}

export function isEncodableAnytoneAprsAutoTxIntervalSec(seconds: number): boolean {
  if (seconds <= 0) return true;
  if (seconds < ANYTONE_APRS_AUTO_TX_INTERVAL_MIN_SEC) return false;
  if (seconds > ANYTONE_APRS_AUTO_TX_INTERVAL_MAX_SEC) return false;
  const k = encodeAnytoneAprsAutoTxIntervalSec(seconds);
  return k >= 1 && k <= ANYTONE_APRS_AUTO_TX_INTERVAL_MAX_WIRE && decodeAnytoneAprsAutoTxIntervalWire(k) === seconds;
}

/** Nearest encodable auto interval in seconds (0 = off). */
export function snapAnytoneAprsAutoTxIntervalSec(seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 0;
  const s = Math.trunc(seconds);
  if (isEncodableAnytoneAprsAutoTxIntervalSec(s)) return s;
  const k = Math.max(
    1,
    Math.min(ANYTONE_APRS_AUTO_TX_INTERVAL_MAX_WIRE, Math.round(s / 15 - 3)),
  );
  return decodeAnytoneAprsAutoTxIntervalWire(k);
}

export function formatAnytoneAprsAutoTxIntervalWire(
  seconds: number | null | undefined,
  warnings: string[] = [],
): string {
  const input = seconds == null || !Number.isFinite(seconds) ? 0 : Math.trunc(seconds);
  const snapped = snapAnytoneAprsAutoTxIntervalSec(input);
  if (input !== snapped) {
    warnings.push(
      `APRS auto TX interval ${input}s adjusted to ${snapped}s for Anytone wire encoding`,
    );
  }
  return String(encodeAnytoneAprsAutoTxIntervalSec(snapped));
}

export function parseAnytoneAprsAutoTxIntervalWire(wire: string): number {
  const k = Number.parseInt(wire.trim(), 10);
  if (!Number.isFinite(k)) return 0;
  return decodeAnytoneAprsAutoTxIntervalWire(k);
}

export function formatAnytoneAprsChannelSlot(channelSlot: number | null | undefined): string {
  if (channelSlot == null || channelSlot <= 0) return '0';
  return String(Math.trunc(channelSlot));
}

export function formatAnytoneAprsTargetDmrId(dmrId: number | null | undefined): string {
  if (dmrId == null || !Number.isFinite(dmrId)) return '0';
  return String(Math.trunc(dmrId));
}

export interface AnytoneAprsCoordinateWire {
  degrees: string;
  minInt: string;
  minMark: string;
  hemisphere: string;
}

function decomposeLatitude(lat: number): AnytoneAprsCoordinateWire {
  const abs = Math.abs(lat);
  const degrees = Math.floor(abs);
  const minutesTotal = (abs - degrees) * 60;
  const minInt = Math.floor(minutesTotal);
  const minMark = Math.round((minutesTotal - minInt) * 100);
  return {
    degrees: String(degrees),
    minInt: String(minInt),
    minMark: String(minMark),
    hemisphere: lat >= 0 ? '0' : '1',
  };
}

function decomposeLongitude(lon: number): AnytoneAprsCoordinateWire {
  const abs = Math.abs(lon);
  const degrees = Math.floor(abs);
  const minutesTotal = (abs - degrees) * 60;
  const minInt = Math.floor(minutesTotal);
  const minMark = Math.round((minutesTotal - minInt) * 100);
  return {
    degrees: String(degrees),
    minInt: String(minInt),
    minMark: String(minMark),
    hemisphere: lon >= 0 ? '0' : '1',
  };
}

const ZERO_COORDINATE: AnytoneAprsCoordinateWire = {
  degrees: '0',
  minInt: '0',
  minMark: '0',
  hemisphere: '0',
};

export interface AnytoneAprsPositionWire {
  fixedLocationBeacon: '0' | '1';
  latitude: AnytoneAprsCoordinateWire;
  longitude: AnytoneAprsCoordinateWire;
}

export function formatAnytoneFixedLocation(
  location: GeoPoint | null | undefined,
): AnytoneAprsPositionWire {
  if (!location) {
    return {
      fixedLocationBeacon: '0',
      latitude: { ...ZERO_COORDINATE },
      longitude: { ...ZERO_COORDINATE },
    };
  }
  return {
    fixedLocationBeacon: '1',
    latitude: decomposeLatitude(location.lat),
    longitude: decomposeLongitude(location.lon),
  };
}

export function formatAnytonePositionSource(
  positionSource: AprsPositionSource,
  fixedLocation: GeoPoint | null | undefined,
): AnytoneAprsPositionWire {
  if (positionSource === 'fixed') {
    return formatAnytoneFixedLocation(fixedLocation);
  }
  return {
    fixedLocationBeacon: '0',
    latitude: { ...ZERO_COORDINATE },
    longitude: { ...ZERO_COORDINATE },
  };
}

export function formatAnytoneAprsReportChannel(
  reportType: AprsReportType,
  slotIndex: number | null | undefined,
): string {
  if (reportType !== 'digital' || slotIndex == null || slotIndex < 1) {
    return '1';
  }
  return String(Math.trunc(slotIndex));
}
