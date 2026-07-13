import { useEffect, useState } from 'react';
import { Switch, Table, Text } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { WireNameOverrideInput } from '../WirePreviewTable.tsx';
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

  if (rows.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No channels to edit.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Skip from export</Table.Th>
          <Table.Th>Library name</Table.Th>
          <Table.Th>Export name</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => {
          const effectivelyIncluded = rowEffectivelyIncluded(row);
          return (
            <Table.Tr key={row.key} opacity={effectivelyIncluded ? 1 : 0.55}>
              <Table.Td>
                <Switch
                  size="xs"
                  label="Skip from export"
                  checked={row.excluded}
                  onChange={(event) => onExcludedChange(row, event.currentTarget.checked)}
                  aria-label={`Skip ${row.displayLabel} from export`}
                />
              </Table.Td>
              <Table.Td>
                <WirePreviewDisplayCell row={row} />
              </Table.Td>
              <Table.Td>
                <WireNameOverrideInput
                  key={`${row.key}:${row.hasWireNameOverride ? row.effectiveWireName : ''}`}
                  row={row}
                  nameLimit={nameLimit}
                  excluded={!effectivelyIncluded}
                  clickableDefaultWireName
                  onWireNameChange={onWireNameChange}
                  onDirtyChange={(dirty) => setRowDirty(row.key, dirty)}
                />
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
