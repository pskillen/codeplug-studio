import { Stack, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import {
  RADIO_BACKUP_LABEL_MAX,
  type RadioBackupLabels,
} from '@integrations/radio-io/backup/index.ts';

export interface BackupLabelFieldsProps {
  /** The committed values. Changing them from outside resets the inputs. */
  value: RadioBackupLabels;
  /** Called with the typed values when an input loses focus and they differ from `value`. */
  onCommit: (next: RadioBackupLabels) => void;
  disabled?: boolean;
  /** Prefix for input ids when two sets appear on one page. */
  idPrefix?: string;
}

/** Optional radio name, label and description for a backup or debug capture. */
export default function BackupLabelFields({
  value,
  onCommit,
  disabled,
  idPrefix = 'backup-labels',
}: BackupLabelFieldsProps) {
  const [draft, setDraft] = useState<RadioBackupLabels>(value);
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
  }
  const flush = () => {
    const same =
      (draft.radioName ?? '') === (value.radioName ?? '') &&
      (draft.label ?? '') === (value.label ?? '') &&
      (draft.description ?? '') === (value.description ?? '');
    if (!same) onCommit(draft);
  };
  return (
    <Stack gap="xs">
      <TextInput
        id={`${idPrefix}-radio-name`}
        label="Radio name"
        description="Optional. For example “Radio 1”. Tells several radios apart."
        maxLength={RADIO_BACKUP_LABEL_MAX.radioName}
        value={draft.radioName ?? ''}
        disabled={disabled}
        onChange={(e) => setDraft({ ...draft, radioName: e.currentTarget.value })}
        onBlur={flush}
      />
      <TextInput
        id={`${idPrefix}-label`}
        label="Label"
        description="Optional. A short title for this backup."
        maxLength={RADIO_BACKUP_LABEL_MAX.label}
        value={draft.label ?? ''}
        disabled={disabled}
        onChange={(e) => setDraft({ ...draft, label: e.currentTarget.value })}
        onBlur={flush}
      />
      <Textarea
        id={`${idPrefix}-description`}
        label="Description"
        description="Optional. Notes for yourself. Stored in the file, never used to match a radio."
        maxLength={RADIO_BACKUP_LABEL_MAX.description}
        rows={3}
        value={draft.description ?? ''}
        disabled={disabled}
        onChange={(e) => setDraft({ ...draft, description: e.currentTarget.value })}
        onBlur={flush}
      />
    </Stack>
  );
}

/** One-line summary for lists: "Radio 1 · Before update", or null when neither is set. */
export function backupLabelSummary(labels: RadioBackupLabels): string | null {
  const parts = [labels.radioName, labels.label].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
