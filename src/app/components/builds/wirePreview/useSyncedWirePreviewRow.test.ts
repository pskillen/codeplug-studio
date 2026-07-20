import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { useSyncedWirePreviewRow } from './useSyncedWirePreviewRow.ts';

const baseRow: WirePreviewRow = {
  key: 'ch-1',
  libraryEntityId: 'ch-1',
  entityKind: 'channel',
  displayLabel: 'GB3DA Demo',
  generatedWireName: 'GB3DA Demo',
  effectiveWireName: 'GB3DA Demo',
  hasWireNameOverride: false,
  hasOrderOrSlotOverride: false,
  excluded: false,
};

const expandedRow: WirePreviewRow = {
  ...baseRow,
  key: 'ch-1:tg-9',
  displayDetails: [{ label: 'Talk group', value: 'Local 9 (9) · Slot 1' }],
};

type HookProps = {
  selectedRowKey: string | null;
  previewRows: WirePreviewRow[];
};

function renderSyncedRowHook(initialProps: HookProps) {
  return renderHook(
    ({ selectedRowKey, previewRows }) => useSyncedWirePreviewRow(selectedRowKey, previewRows),
    { initialProps },
  );
}

describe('useSyncedWirePreviewRow', () => {
  it('returns fresh row data when preview rows update after persist', () => {
    const rows = [baseRow];

    const { result, rerender } = renderSyncedRowHook({ selectedRowKey: 'ch-1', previewRows: rows });

    expect(result.current?.excluded).toBe(false);

    const updatedRows = [{ ...baseRow, excluded: true }];
    rerender({ selectedRowKey: 'ch-1', previewRows: updatedRows });

    expect(result.current?.excluded).toBe(true);
  });

  it('clears when selection is cleared', () => {
    const { result, rerender } = renderSyncedRowHook({
      selectedRowKey: 'ch-1',
      previewRows: [baseRow],
    });

    rerender({ selectedRowKey: null, previewRows: [baseRow] });

    expect(result.current).toBeNull();
  });

  it('falls back to collapsed parent row when expansion key disappears', () => {
    const { result, rerender } = renderSyncedRowHook({
      selectedRowKey: 'ch-1:tg-9',
      previewRows: [expandedRow],
    });

    expect(result.current?.key).toBe('ch-1:tg-9');

    rerender({
      selectedRowKey: 'ch-1:tg-9',
      previewRows: [{ ...baseRow, excluded: true }],
    });

    expect(result.current?.key).toBe('ch-1');
    expect(result.current?.excluded).toBe(true);
  });
});
