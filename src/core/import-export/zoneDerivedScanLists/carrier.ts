import { newChannel } from '@core/domain/factories.ts';
import { applyWireNameLimits } from '../channelExpansion/exportWireNames.ts';
import type { ExportWarning } from '../exportWarning.ts';

export const DEFAULT_SCAN_CARRIER_HZ = 145_500_000;

export interface SyntheticScanCarrier {
  zoneId: string;
  zoneName: string;
  wireName: string;
  frequencyHz: number;
  scanListName: string;
}

export function zoneScanCarrierWireName(
  zoneName: string,
  profileId: string,
  reserved: Set<string>,
  warnings: ExportWarning[],
): string {
  const base = `${zoneName} Scan`.trim();
  const stub = {
    ...newChannel('', base),
    id: 'carrier',
    projectId: '',
  };
  return applyWireNameLimits(base, stub, reserved, { shortenNames: true }, profileId, warnings);
}

export function isZoneScanCarrierChannelId(channelId: string): boolean {
  return channelId.startsWith('scan-carrier:');
}
