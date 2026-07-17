import { useEffect, useState } from 'react';
import { Switch, Text } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import DataTable, { type DataTableColumn } from '../../ui/DataTable.tsx';
import { WireNameOverrideInput } from './WireNameOverrideInput.tsx';
import { rowEffectivelyIncluded } from './wirePreviewRowUtils.ts';
import WirePreviewDisplayCell from './WirePreviewDisplayCell.tsx';

export interface WirePreviewBulkEditTableProps {
  rows: WirePreviewRow[];
  nameLimit?: number;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  onUnsavedChangesChange?: (hasUnsaved: boolean) => void;
}

export default function WirePreviewBulkEditTable({
  rows,
  nameLimit,
  onExcludedChange,
  onWireNameChange,
  onUnsavedChangesChange,
}: WirePreviewBulkEditTableProps) {
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    onUnsavedChangesChange?.(dirtyKeys.size > 0);
  }, [dirtyKeys, onUnsavedChangesChange]);

  const setRowDirty = (key: string, dirty: boolean) => {
    setDirtyKeys((prev) => {
      const has = prev.has(key);
      if (dirty === has) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const columns: DataTableColumn<WirePreviewRow>[] = [
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
            key={`${row.key}:${row.hasWireNameOverride ? row.effectiveWireName : ''}`}
            row={row}
            nameLimit={nameLimit}
            excluded={!effectivelyIncluded}
            clickableDefaultWireName
            onWireNameChange={onWireNameChange}
            onDirtyChange={(dirty) => setRowDirty(row.key, dirty)}
          />
        );
      },
    },
  ];

  if (rows.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No channels to edit.
      </Text>
    );
  }

  return (
    <DataTable
      variant="embedded"
      rows={rows}
      rowKey={(row) => row.key}
      showSearch={false}
      nameColumn={{
        header: 'Library name',
        getName: (row) => row.displayLabel,
        getPath: () => '#',
        render: (row) => <WirePreviewDisplayCell row={row} />,
      }}
      columns={columns}
    />
  );
}
