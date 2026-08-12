import { useEffect, useMemo, useState } from 'react';
import { Switch, Text } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { DataTable, type DataTableColumn } from '../../v2/index.ts';
import { createNameColumn } from '../../../lib/libraryListTable.tsx';
import { WireNameOverrideInput } from './WireNameOverrideInput.tsx';
import { rowEffectivelyIncluded, wireNameCommittedValue } from './wirePreviewRowUtils.ts';
import WirePreviewDisplayCell from './WirePreviewDisplayCell.tsx';

export interface WirePreviewBulkEditTableProps {
  rows: WirePreviewRow[];
  nameLimit?: number;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  /** Fired whenever pending wire-name drafts change (row key → draft). */
  onPendingWireNamesChange?: (pending: Map<string, string>) => void;
  onUnsavedChangesChange?: (hasUnsaved: boolean) => void;
  /**
   * Increment after a page-level Save to clear local drafts and remount inputs
   * once commits have been queued.
   */
  draftEpoch?: number;
}

export default function WirePreviewBulkEditTable({
  rows,
  nameLimit,
  onExcludedChange,
  onPendingWireNamesChange,
  onUnsavedChangesChange,
  draftEpoch = 0,
}: WirePreviewBulkEditTableProps) {
  const [pendingByKey, setPendingByKey] = useState<Map<string, string>>(() => new Map());
  const [inputEpoch, setInputEpoch] = useState(0);

  useEffect(() => {
    setPendingByKey(new Map());
    setInputEpoch((value) => value + 1);
  }, [draftEpoch]);

  useEffect(() => {
    onPendingWireNamesChange?.(pendingByKey);
    onUnsavedChangesChange?.(pendingByKey.size > 0);
  }, [pendingByKey, onPendingWireNamesChange, onUnsavedChangesChange]);

  const setRowDraft = (row: WirePreviewRow, draft: string) => {
    const committed = wireNameCommittedValue(row);
    setPendingByKey((prev) => {
      const has = prev.has(row.key);
      if (draft === committed) {
        if (!has) return prev;
        const next = new Map(prev);
        next.delete(row.key);
        return next;
      }
      if (has && prev.get(row.key) === draft) return prev;
      const next = new Map(prev);
      next.set(row.key, draft);
      return next;
    });
  };

  const columns = useMemo((): DataTableColumn<WirePreviewRow>[] => {
    return [
      createNameColumn<WirePreviewRow>({
        header: 'Library name',
        getName: (row) => row.displayLabel,
        getPath: () => '#',
        render: (row) => <WirePreviewDisplayCell row={row} />,
      }),
      {
        key: 'skip',
        header: 'Skip from export',
        hideable: false,
        render: (row) => (
          <Switch
            size="xs"
            label="Skip from export"
            checked={row.excluded}
            onChange={(event) => onExcludedChange(row, event.currentTarget.checked)}
            aria-label={`Skip ${row.displayLabel} from export`}
          />
        ),
      },
      {
        key: 'exportName',
        header: 'Export name',
        hideable: false,
        render: (row) => {
          const effectivelyIncluded = rowEffectivelyIncluded(row);
          return (
            <WireNameOverrideInput
              key={`${row.key}:${inputEpoch}:${row.hasWireNameOverride ? row.effectiveWireName : ''}`}
              row={row}
              nameLimit={nameLimit}
              excluded={!effectivelyIncluded}
              clickableDefaultWireName
              deferCommit
              onWireNameChange={() => {}}
              onDraftChange={(draft) => setRowDraft(row, draft)}
              onDirtyChange={() => {}}
            />
          );
        },
      },
    ];
  }, [nameLimit, onExcludedChange, inputEpoch]);

  if (rows.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No channels to edit.
      </Text>
    );
  }

  return <DataTable variant="embedded" rows={rows} getRowId={(row) => row.key} columns={columns} />;
}
