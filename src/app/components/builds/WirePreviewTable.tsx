import {
  ActionIcon,
  Anchor,
  Group,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { libraryEditPathForWirePreviewRow } from '../../lib/wirePreviewRowLinks.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';

export interface WirePreviewTableProps {
  rows: WirePreviewRow[];
  nameLimit?: number;
  clickableDefaultWireName?: boolean;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  onUnsavedChangesChange?: (hasUnsaved: boolean) => void;
}

function wireNameCommittedValue(row: WirePreviewRow): string {
  return row.hasWireNameOverride ? row.effectiveWireName : '';
}

function WireNameOverrideInput({
  row,
  nameLimit,
  excluded,
  clickableDefaultWireName,
  onWireNameChange,
  onDirtyChange,
}: {
  row: WirePreviewRow;
  nameLimit?: number;
  excluded: boolean;
  clickableDefaultWireName?: boolean;
  onWireNameChange: (row: WirePreviewRow, wireName: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const committed = wireNameCommittedValue(row);
  const [draft, setDraft] = useState(committed);
  const dirty = draft !== committed;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const tooLong = nameLimit != null && draft.length > nameLimit;

  const apply = () => {
    onWireNameChange(row, draft);
  };

  const revert = () => {
    setDraft(committed);
  };

  const applyDefault = () => {
    setDraft(row.generatedWireName);
    onWireNameChange(row, row.generatedWireName);
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
        Default:{' '}
        {clickableDefaultWireName ? (
          <Tooltip label="Store this name as an explicit override">
            <UnstyledButton
              component="button"
              type="button"
              disabled={excluded}
              onClick={applyDefault}
              style={{
                color: 'var(--mantine-color-dimmed)',
                textDecoration: 'underline',
                cursor: excluded ? 'not-allowed' : 'pointer',
              }}
            >
              {row.generatedWireName}
            </UnstyledButton>
          </Tooltip>
        ) : (
          row.generatedWireName
        )}
      </Text>
    </>
  );
}

export default function WirePreviewTable({
  rows,
  nameLimit,
  clickableDefaultWireName = false,
  onExcludedChange,
  onWireNameChange,
  onUnsavedChangesChange,
}: WirePreviewTableProps) {
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
              <Anchor component={Link} to={libraryEditPathForWirePreviewRow(row)} size="xs">
                Edit in library
              </Anchor>
            </Table.Td>
            <Table.Td>
              <WireNameOverrideInput
                key={`${row.key}:${wireNameCommittedValue(row)}`}
                row={row}
                nameLimit={nameLimit}
                excluded={row.excluded}
                clickableDefaultWireName={clickableDefaultWireName}
                onWireNameChange={onWireNameChange}
                onDirtyChange={(dirty) => setRowDirty(row.key, dirty)}
              />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
