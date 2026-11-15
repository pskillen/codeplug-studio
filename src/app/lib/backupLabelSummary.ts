import type { RadioBackupLabels } from '@integrations/radio-io/backup/index.ts';

/** One-line summary for lists: "Radio 1 · Before update", or null when neither is set. */
export function backupLabelSummary(labels: RadioBackupLabels): string | null {
  const parts = [labels.radioName, labels.label].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
