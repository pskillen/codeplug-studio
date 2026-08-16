import { useCallback, useMemo } from 'react';
import { Switch, Text } from '@mantine/core';
import type { Dispatch, SetStateAction } from 'react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { DataTable, type DataTableColumn } from '../../v2/index.ts';
import { createNameColumn } from '../../../lib/libraryListTable.tsx';
import WireNameInlineEditor from './WireNameInlineEditor.tsx';
import { rowEffectivelyIncluded, wireNameCommittedValue } from './wirePreviewRowUtils.ts';
import WirePreviewDisplayCell from './WirePreviewDisplayCell.tsx';

export interface WirePreviewBulkEditTableProps {
  rows: WirePreviewRow[];
  nameLimit?: number;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  /** Parent-owned pending drafts keyed by row `key`. */
  onPendingWireNamesChange: Dispatch<SetStateAction<Map<string, string>>>;
  /**
   * Increment after a page-level Save to remount draft inputs once commits
   * have been queued (parent clears pending in the same turn).
   */
  draftEpoch?: number;
}

export default function WirePreviewBulkEditTable({
  rows,
  nameLimit,
  onExcludedChange,
  onPendingWireNamesChange,
  draftEpoch = 0,
}: WirePreviewBulkEditTableProps) {
  const setRowDraft = useCallback(
    (row: WirePreviewRow, draft: string) => {
      onPendingWireNamesChange((prev) => {
        const committed = wireNameCommittedValue(row);
        const next = new Map(prev);
        if (draft === committed) {
          next.delete(row.key);
        } else {
          next.set(row.key, draft);
        }
        return next;
      });
    },
    [onPendingWireNamesChange],
  );

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
            <WireNameInlineEditor
              key={`${row.key}:${draftEpoch}:${row.hasWireNameOverride ? row.effectiveWireName : ''}`}
              committedValue={wireNameCommittedValue(row)}
              suggestions={[{ value: row.generatedWireName }]}
              limit={nameLimit}
              disabled={!effectivelyIncluded}
              deferCommit
              onCommit={() => {}}
              onDraftChange={(draft) => setRowDraft(row, draft)}
            />
          );
        },
      },
    ];
  }, [nameLimit, onExcludedChange, draftEpoch, setRowDraft]);

  if (rows.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No channels to edit.
      </Text>
    );
  }

  return <DataTable variant="embedded" rows={rows} getRowId={(row) => row.key} columns={columns} />;
}
