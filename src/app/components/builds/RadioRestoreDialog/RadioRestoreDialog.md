# RadioRestoreDialog

## Purpose

Modal dialog for **Restore** on the Backup / Restore tab: the same `EgressShell` frame as Write (Connect → Review → Restoring → optional Restart → Done).

## Props

| Prop      | Type                 | Description                                      |
| --------- | -------------------- | ------------------------------------------------ |
| `options` | `WriteShellOptions`  | Radio label, restart seconds, success note, etc. |
| `view`    | `RestoreFlowView`    | Step, pre-flight, review facts, progress, errors |
| `actions` | `RestoreFlowActions` | Close, cancel, restore, retry, Back to Export    |

## Usage

```tsx
const flow = useRadioRestoreFlow({ egress, descriptor, profileId });
<RadioRestoreDialog
  options={resolveWriteShellOptions(egress, descriptor)}
  view={flow.view}
  actions={flow.actions}
/>;
```

## Behaviour

- **Connect:** port picker, then `PreflightCard` (model, full serial, serial match). Identity mismatch refuses with `retry: 'none'`.
- **Review:** always shown; names the radio and backup serial in full; range-change note when the AT-D890 range differs; destructive **Restore to this radio**.
- **Restoring:** `StageProgress` with the adapter’s `restore` plan.
- **Restart:** countdown when `restartAfterEndSeconds > 0`; no check step.
- **Done:** green summary, radio `successNote` when set, **Back to Export**.

Errors use [`ErrorPanel`](../../egress/ErrorPanel/ErrorPanel.md).

## Related

- [backup-restore.md](../../../../docs/features/radio-read-write/backup-restore.md)
