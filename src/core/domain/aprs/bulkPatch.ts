import type { ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPttMode, AprsReportType } from '@core/models/libraryTypes.ts';
import { CHANNEL_APRS_OFF } from './defaults.ts';

export interface AprsChannelBulkPatch {
  clearBinding?: boolean;
  reportSlotIndex?: number | null;
  patchReportSlot?: boolean;
  reportType?: AprsReportType;
  patchReportType?: boolean;
  receiveEnabled?: boolean;
  patchReceiveEnabled?: boolean;
  digitalPttMode?: AprsPttMode;
  patchDigitalPttMode?: boolean;
}

export function applyAprsChannelBulkPatch(
  current: ChannelAprsBinding | undefined,
  patch: AprsChannelBulkPatch,
): ChannelAprsBinding | undefined {
  if (patch.clearBinding) return undefined;
  const base = current ?? { ...CHANNEL_APRS_OFF };
  return {
    receiveEnabled: patch.patchReceiveEnabled ? Boolean(patch.receiveEnabled) : base.receiveEnabled,
    reportType: patch.patchReportType ? (patch.reportType ?? 'off') : base.reportType,
    digitalPttMode: patch.patchDigitalPttMode
      ? (patch.digitalPttMode ?? 'off')
      : base.digitalPttMode,
    reportSlotIndex: patch.patchReportSlot ? (patch.reportSlotIndex ?? null) : base.reportSlotIndex,
  };
}

export function aprsChannelBulkPatchHasChanges(patch: AprsChannelBulkPatch): boolean {
  return Boolean(
    patch.clearBinding ||
    patch.patchReportSlot ||
    patch.patchReportType ||
    patch.patchReceiveEnabled ||
    patch.patchDigitalPttMode,
  );
}
