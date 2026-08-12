import {
  ActionIcon,
  Group,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';

export function SatelliteWireNameOverrideInput({
  committedWireName,
  generatedWireName,
  nameLimit,
  onWireNameChange,
  onDirtyChange,
}: {
  committedWireName: string;
  generatedWireName: string;
  nameLimit: number;
  onWireNameChange: (wireName: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(committedWireName ?? '');
  const dirty = draft !== committedWireName;

  useEffect(() => {
    setDraft(committedWireName);
  }, [committedWireName]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const tooLong = draft.length > nameLimit;

  const apply = () => {
    onWireNameChange(draft);
  };

  const revert = () => {
    setDraft(committedWireName);
  };

  const applyDefault = () => {
    setDraft(generatedWireName);
    onWireNameChange(generatedWireName);
  };

  const clearOverride = () => {
    setDraft(generatedWireName);
    onWireNameChange('');
  };

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          flex={1}
          size="xs"
          placeholder={generatedWireName}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && dirty && !tooLong) {
              event.preventDefault();
              apply();
            }
            if (event.key === 'Escape' && dirty) {
              event.preventDefault();
              revert();
            }
          }}
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
                disabled={tooLong}
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
        <Tooltip label="Store this name as an explicit override">
          <UnstyledButton
            component="button"
            type="button"
            onClick={applyDefault}
            style={{
              color: 'var(--mantine-color-dimmed)',
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            {generatedWireName}
          </UnstyledButton>
        </Tooltip>
        {' · '}
        <UnstyledButton
          component="button"
          type="button"
          onClick={clearOverride}
          style={{
            color: 'var(--mantine-color-dimmed)',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Reset
        </UnstyledButton>
      </Text>
    </Stack>
  );
}
