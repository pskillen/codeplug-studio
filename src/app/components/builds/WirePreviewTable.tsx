import { ActionIcon, Group, Switch, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';

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
  const [draft, setDraft] = useState(committed);
  const dirty = draft !== committed;

  useEffect(() => {
    setDraft(committed);
  }, [committed, row.key]);

  const tooLong = nameLimit != null && draft.length > nameLimit;

  const apply = () => {
    onWireNameChange(row, draft);
  };

  const revert = () => {
    setDraft(committed);
  };

  return (
    <>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          flex={1}
          size="xs"
          placeholder={row.generatedWireName}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && dirty && !tooLong && !excluded) {
              event.preventDefault();
              apply();
            }
            if (event.key === 'Escape' && dirty) {
              event.preventDefault();
              revert();
            }
          }}
          disabled={excluded}
          error={tooLong ? `Exceeds ${nameLimit} characters` : undefined}
        />
        {dirty ? (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Apply wire name">
              <ActionIcon
                variant="light"
                color="green"
                size="sm"
                aria-label="Apply wire name"
                disabled={tooLong || excluded}
                onClick={apply}
              >
                <IconCheck size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Revert wire name">
              <ActionIcon
                variant="light"
                color="gray"
                size="sm"
                aria-label="Revert wire name"
                onClick={revert}
              >
                <IconX size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null}
      </Group>
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
