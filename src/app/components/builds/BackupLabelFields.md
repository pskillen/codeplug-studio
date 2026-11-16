# BackupLabelFields

## Purpose

Three optional text inputs, **Radio name**, **Label** and **Description**, for a radio backup or a debug capture. Descriptive only: the values are never used to match a radio, as a key, or in a CPS export.

## Props

| Prop       | Purpose                                                                        |
| ---------- | ------------------------------------------------------------------------------ |
| `value`    | Committed values. A new object from outside resets the inputs.                 |
| `onCommit` | Called with the typed values when an input blurs and they differ from `value`. |
| `disabled` | Disables all three inputs.                                                     |
| `idPrefix` | Distinguishes two sets on one page.                                            |

## Behaviour

Text is held locally and committed on blur, so a keystroke never rewrites the archive. Length caps come from `RADIO_BACKUP_LABEL_MAX` in `src/integrations/radio-io/backup/`; blanks are dropped when stored. `backupLabelSummary` (`src/app/lib/backupLabelSummary.ts`) gives the one-line "Radio name · Label" form used in lists.

## Related

[Backup / Restore](../../../../docs/features/radio-read-write/backup-restore.md), [Radio debug](../../../../docs/features/radio-debug/README.md)
