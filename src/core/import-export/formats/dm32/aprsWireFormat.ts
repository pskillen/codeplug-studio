import type { ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPttMode, AprsReportType, ChannelMode } from '@core/models/libraryTypes.ts';
import { isAnalogMode } from './channelModes.ts';

export function formatDm32AprsReportType(
  reportType: AprsReportType | undefined,
): 'Off' | 'Digital' {
  return reportType === 'digital' ? 'Digital' : 'Off';
}

export function formatDm32AprsFlagWire(enabled: boolean | undefined): '0' | '1' {
  return enabled ? '1' : '0';
}

export function formatDm32DigitalAprsPttWire(mode: AprsPttMode | undefined): '0' | '1' {
  return mode === 'on' ? '1' : '0';
}

/**
 * `APRS Report Channel` wire.
 * Digital reporting → slot index (default 1). Off + analog row → 256 placeholder; off + digital → 1.
 */
export function formatDm32AprsReportChannelWire(
  aprs: ChannelAprsBinding | undefined,
  rowMode: ChannelMode,
): string {
  if (aprs?.reportType === 'digital') {
    const slot = aprs.reportSlotIndex;
    if (slot != null && slot >= 1) return String(Math.trunc(slot));
    return '1';
  }
  if (isAnalogMode(rowMode)) return '256';
  return '1';
}

export function dm32ChannelAprsWireCells(
  aprs: ChannelAprsBinding | undefined,
  rowMode: ChannelMode,
): {
  aprsReportType: 'Off' | 'Digital';
  aprsReceive: '0' | '1';
  analogAprsPtt: '0';
  digitalAprsPtt: '0' | '1';
  aprsReportChannel: string;
} {
  return {
    aprsReportType: formatDm32AprsReportType(aprs?.reportType),
    aprsReceive: formatDm32AprsFlagWire(aprs?.receiveEnabled),
    analogAprsPtt: '0',
    digitalAprsPtt: formatDm32DigitalAprsPttWire(aprs?.digitalPttMode),
    aprsReportChannel: formatDm32AprsReportChannelWire(aprs, rowMode),
  };
}
