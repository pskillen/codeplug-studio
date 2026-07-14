import type { AprsPttMode, AprsReportType, AprsSlotCallType, DMRTimeSlot } from '@core/models/libraryTypes.ts';
import type { AprsPositionSource } from '@core/models/libraryTypes.ts';
import type { GeoPoint } from '@core/models/libraryTypes.ts';

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

export function formatAnytoneFixedLocation(location: GeoPoint | null | undefined): AnytoneAprsPositionWire {
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

export function formatAnytoneAprsReportChannel(slotIndex: number | null | undefined): string {
  if (slotIndex == null || slotIndex < 1) return '1';
  return String(Math.trunc(slotIndex));
}
