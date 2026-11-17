# DriveOutgoingChangesModal

"Changes to save to Google Drive" dialog: a read-only review of what **Save to Drive** would write over the linked file.

## Purpose

Until now the operator could see what Drive would change **in** (Refresh from Drive) but not what a Save would send **out**. This shows the outgoing side, reusing the same itemised change list.

## Props

| Prop          | Type                          | Notes                                                                                |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| `opened`      | `boolean`                     | Modal visibility                                                                     |
| `projectName` | `string`                      | Shown in the intro line                                                              |
| `fileName`    | `string`                      | Linked Drive file name                                                               |
| `review`      | `DriveOutgoingReview \| null` | Entity changes and count summary from the Drive file's point of view, plus conflicts |
| `saving`      | `boolean`                     | A save started from this dialog is running                                           |
| `onClose`     | `() => void`                  | **Close** / x / Escape                                                               |
| `onSave`      | `() => void`                  | **Save to Drive** — the normal save flow, which still asks first on a conflict       |

## Behaviour

- Lists entities by UUID: **Added** = new on Drive after saving, **Removed** = deleted from Drive, **Changed** = different content. The heading carries the count summary (for example "+2 channels, -1 zone"). Built by `buildDriveOutgoingReview` (`invertEntityChanges` in `projectEntityDiff.ts`).
- Warns when Drive has a newer version than this browser last synced, or the linked file belongs to a different project. Saving then still goes through the Drive save conflict modal.
- No differences shows "only timestamps differ".
- Opened by **Review changes to save** in `SidebarDriveControls`; nothing is written until **Save to Drive** is clicked.

## Related

- `ProjectEntityChangeList` (shared with `InterchangeOverwriteModal`)
- [google-drive.md](../../../../docs/features/import-export/google-drive.md)
