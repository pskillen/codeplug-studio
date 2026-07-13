import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

export function wireNameCommittedValue(row: WirePreviewRow): string {
  return row.hasWireNameOverride ? row.effectiveWireName : '';
}

export function rowEffectivelyIncluded(row: WirePreviewRow): boolean {
  return !row.excluded && (row.forceInclude === true || row.omitFromExport !== true);
}

export function wirePreviewExportStatusLabel(row: WirePreviewRow): string | null {
  if (row.excluded) return 'Skipped';
  if (row.omitFromExport && row.forceInclude !== true) return 'Not exported as zone';
  if (row.omitFromExport && row.forceInclude) return 'Force exported';
  return null;
}
