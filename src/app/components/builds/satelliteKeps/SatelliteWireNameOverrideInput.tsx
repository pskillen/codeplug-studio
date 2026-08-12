import { ActionIcon, Group, Stack, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';

export function SatelliteWireNameOverrideInput({
  committedWireName,
  suggestedFamiliar,
  suggestedOscar,
  nameLimit,
  onWireNameChange,
  onDirtyChange,
  onCancel,
}: {
  committedWireName: string;
  suggestedFamiliar: string;
  suggestedOscar?: string | null;
  nameLimit: number;
  onWireNameChange: (wireName: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(committedWireName ?? '');
  const dirty = draft !== committedWireName;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const tooLong = draft.length > nameLimit;

  const apply = () => {
    onWireNameChange(draft);
  };

  const revert = () => {
    setDraft(committedWireName);
    onCancel?.();
  };

  const applySuggestion = (value: string) => {
    setDraft(value);
  };

  const clearOverride = () => {
    setDraft('');
    onWireNameChange('');
  };

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          flex={1}
          size="xs"
          placeholder={suggestedFamiliar}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && dirty && !tooLong) {
              event.preventDefault();
              apply();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              revert();
            }
          }}
          error={tooLong ? `Exceeds ${nameLimit} characters` : undefined}
          autoFocus
        />
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Apply wire name">
            <ActionIcon
              variant="light"
              color="green"
              size="sm"
              aria-label="Apply wire name"
              disabled={!dirty || tooLong}
              onClick={apply}
            >
              <IconCheck size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Cancel">
            <ActionIcon
              variant="light"
              color="gray"
              size="sm"
              aria-label="Cancel wire name edit"
              onClick={revert}
            >
              <IconX size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Text size="xs" c="dimmed">
        Familiar:{' '}
        <SuggestionButton
          label="Use this suggested name"
          onClick={() => applySuggestion(suggestedFamiliar)}
        >
          {suggestedFamiliar}
        </SuggestionButton>
        {suggestedOscar ? (
          <>
            {' · '}
            OSCAR:{' '}
            <SuggestionButton
              label="Use this suggested name"
              onClick={() => applySuggestion(suggestedOscar)}
            >
              {suggestedOscar}
            </SuggestionButton>
          </>
        ) : null}
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

function SuggestionButton({
  children,
  label,
  onClick,
}: {
  children: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label}>
      <UnstyledButton
        component="button"
        type="button"
        onClick={onClick}
        style={{
          color: 'var(--mantine-color-dimmed)',
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {children}
      </UnstyledButton>
    </Tooltip>
  );
}
