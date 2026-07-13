import { useMemo } from 'react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

function libraryEntityIdFromRowKey(rowKey: string): string {
  const colon = rowKey.indexOf(':');
  return colon === -1 ? rowKey : rowKey.slice(0, colon);
}

/**
 * Resolve the latest preview row for an open override modal.
 * Falls back to the parent channel row when expansion collapses (e.g. skip removes
 * fan-out rows from preview until the channel is included again).
 */
export function useSyncedWirePreviewRow(
  selectedRowKey: string | null,
  rows: WirePreviewRow[],
): WirePreviewRow | null {
  return useMemo(() => {
    if (!selectedRowKey) return null;

    const direct = rows.find((row) => row.key === selectedRowKey);
    if (direct) return direct;

    const libraryEntityId = libraryEntityIdFromRowKey(selectedRowKey);
    const collapsed = rows.find(
      (row) => row.libraryEntityId === libraryEntityId && row.key === libraryEntityId,
    );
    if (collapsed) return collapsed;

    return rows.find((row) => row.libraryEntityId === libraryEntityId) ?? null;
  }, [selectedRowKey, rows]);
}
