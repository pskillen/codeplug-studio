import { Switch, Table, Text, TextInput } from '@mantine/core';
import { useCallback } from 'react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { useDebouncedNameFilter } from '../../hooks/useDebouncedNameFilter.ts';

export interface WirePreviewTableProps {
  rows: WirePreviewRow[];
  nameLimit?: number;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
}

function wireNameCommittedValue(row: WirePreviewRow): string {
  return row.effectiveWireName !== row.generatedWireName ? row.effectiveWireName : '';
}

function WireNameOverrideInput({
  row,
  nameLimit,
  excluded,
  onWireNameChange,
}: {
  row: WirePreviewRow;
  nameLimit?: number;
  excluded: boolean;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
}) {
  const committed = wireNameCommittedValue(row);
  const onCommit = useCallback(
    (value: string) => onWireNameChange(row, value),
    [onWireNameChange, row],
  );
  const { nameFilterInput, setNameFilter } = useDebouncedNameFilter(committed, onCommit);
  const tooLong = nameLimit != null && nameFilterInput.length > nameLimit;

  return (
    <>
      <TextInput
        size="xs"
        placeholder={row.generatedWireName}
        value={nameFilterInput}
        onChange={(event) => setNameFilter(event.currentTarget.value)}
        disabled={excluded}
        error={tooLong ? `Exceeds ${nameLimit} characters` : undefined}
      />
      <Text size="xs" c="dimmed">
        Default: {row.generatedWireName}
      </Text>
    </>
  );
}

export default function WirePreviewTable({
  rows,
  nameLimit,
  onExcludedChange,
  onWireNameChange,
}: WirePreviewTableProps) {
  if (rows.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        No library entities of this type yet.
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Include</Table.Th>
          <Table.Th>Display name</Table.Th>
          <Table.Th>Wire name</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={row.key} opacity={row.excluded ? 0.55 : 1}>
            <Table.Td>
              <Switch
                checked={!row.excluded}
                onChange={(event) => onExcludedChange(row, !event.currentTarget.checked)}
                aria-label={`Include ${row.displayLabel}`}
              />
            </Table.Td>
            <Table.Td>
              <Text size="sm">{row.displayLabel}</Text>
              {row.expansionNote ? (
                <Text size="xs" c="dimmed">
                  {row.expansionNote}
                </Text>
              ) : null}
            </Table.Td>
            <Table.Td>
              <WireNameOverrideInput
                row={row}
                nameLimit={nameLimit}
                excluded={row.excluded}
                onWireNameChange={onWireNameChange}
              />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
