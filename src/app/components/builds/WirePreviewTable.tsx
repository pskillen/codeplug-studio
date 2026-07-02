import { Switch, Table, Text, TextInput } from '@mantine/core';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

export interface WirePreviewTableProps {
  rows: WirePreviewRow[];
  nameLimit?: number;
  saving?: boolean;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
}

export default function WirePreviewTable({
  rows,
  nameLimit,
  saving = false,
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
        {rows.map((row) => {
          const overrideActive = row.effectiveWireName !== row.generatedWireName;
          const tooLong = nameLimit != null && row.effectiveWireName.length > nameLimit;
          return (
            <Table.Tr key={row.key} opacity={row.excluded ? 0.55 : 1}>
              <Table.Td>
                <Switch
                  checked={!row.excluded}
                  onChange={(event) =>
                    onExcludedChange(row, !event.currentTarget.checked)
                  }
                  disabled={saving}
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
                <TextInput
                  size="xs"
                  placeholder={row.generatedWireName}
                  value={overrideActive ? row.effectiveWireName : ''}
                  onChange={(event) => onWireNameChange(row, event.currentTarget.value)}
                  disabled={saving || row.excluded}
                  error={tooLong ? `Exceeds ${nameLimit} characters` : undefined}
                />
                {!overrideActive ? (
                  <Text size="xs" c="dimmed">
                    Generated: {row.generatedWireName}
                  </Text>
                ) : null}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
