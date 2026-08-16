import { ActionIcon, Group, Stack, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';

export interface WireNameSuggestion {
  /** Shown before the link when there is more than one suggestion (e.g. channel style name). */
  label?: string;
  value: string;
}

export interface WireNameInlineEditorProps {
  /** Empty string when no override is set — placeholder shows the (first) suggestion instead. */
  committedValue: string;
  /**
   * One suggestion per *identity* for most entity kinds (wire-name-preview SKILL §"Suggestions").
   * Channel rows are the sole exception (ux-proposal.md §6a): one per `ChannelExportNameMode`.
   */
  suggestions: WireNameSuggestion[];
  limit?: number;
  disabled?: boolean;
  /** When true, Save/Revert are hidden — page-level Save owns persistence (bulk edit). */
  deferCommit?: boolean;
  autoFocus?: boolean;
  /** Save (non-deferred) or accept (deferred, unused — see onDraftChange). */
  onCommit: (value: string) => void;
  onDraftChange?: (value: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Revert / Escape in non-deferred mode — lets a read/edit toggle owner collapse back. */
  onCancel?: () => void;
}

/**
 * Shared wire-name inline editor (wire-preview rework phase 6) — the one place a wire name
 * gets edited without a modal. Used by the CPS wire-preview table cell, the CPS bulk-edit
 * table (deferCommit), the zone/CHIRP override modal's Export tab, and satellite keps.
 *
 * Clicking a suggestion only fills the draft — it never commits (wire-name-preview SKILL).
 */
export default function WireNameInlineEditor({
  committedValue,
  suggestions,
  limit,
  disabled = false,
  deferCommit = false,
  autoFocus = false,
  onCommit,
  onDraftChange,
  onDirtyChange,
  onCancel,
}: WireNameInlineEditorProps) {
  const [draft, setDraft] = useState(committedValue);
  const dirty = draft !== committedValue;
  const placeholder = suggestions[0]?.value ?? '';

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const tooLong = limit != null && draft.length > limit;

  const updateDraft = (value: string) => {
    setDraft(value);
    onDraftChange?.(value);
  };

  const commit = () => {
    onCommit(draft);
  };

  const revert = () => {
    updateDraft(committedValue);
    onCancel?.();
  };

  return (
    <Stack gap={4}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <TextInput
          flex={1}
          size="xs"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => updateDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && dirty && !tooLong && !disabled && !deferCommit) {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              revert();
            }
          }}
          disabled={disabled}
          error={tooLong ? `Exceeds ${limit} characters` : undefined}
          autoFocus={autoFocus}
        />
        {!deferCommit ? (
          <Group gap={4} wrap="nowrap">
            <Tooltip label="Save wire name">
              <ActionIcon
                variant="light"
                color="green"
                size="sm"
                aria-label="Save wire name"
                disabled={!dirty || tooLong || disabled}
                onClick={commit}
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
      {suggestions.length > 0 ? (
        <Text size="xs" c="dimmed">
          {suggestions.length === 1 ? (
            <>
              Suggestion:{' '}
              <SuggestionLink
                value={suggestions[0]!.value}
                disabled={disabled}
                onPick={updateDraft}
              />
            </>
          ) : (
            suggestions.map((suggestion, index) => (
              <span key={`${suggestion.label ?? ''}:${suggestion.value}`}>
                {index > 0 ? ' · ' : ''}
                {suggestion.label ? `${suggestion.label}: ` : ''}
                <SuggestionLink value={suggestion.value} disabled={disabled} onPick={updateDraft} />
              </span>
            ))
          )}
        </Text>
      ) : null}
    </Stack>
  );
}

function SuggestionLink({
  value,
  disabled,
  onPick,
}: {
  value: string;
  disabled?: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <Tooltip label="Use this suggestion">
      <UnstyledButton
        component="button"
        type="button"
        disabled={disabled}
        onClick={() => onPick(value)}
        style={{
          color: 'var(--mantine-color-dimmed)',
          textDecoration: 'underline',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {value || '—'}
      </UnstyledButton>
    </Tooltip>
  );
}
