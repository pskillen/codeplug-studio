import { ActionIcon, Group, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { wireNameCommittedValue } from './wirePreviewRowUtils.ts';

export function WireNameOverrideInput({
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
