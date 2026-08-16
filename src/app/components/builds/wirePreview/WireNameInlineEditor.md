## Purpose

Shared wire-name inline editor (wire-preview rework phase 6) — the one place a wire name gets
edited without a modal, per [wire-name-preview SKILL](../../../../.claude/skills/wire-name-preview/SKILL.md).
Used by [`WirePreviewExportNameCell`](./WirePreviewExportNameCell.md) (CPS list),
[`WirePreviewBulkEditTable`](./WirePreviewBulkEditTable.md) (bulk edit, `deferCommit`),
[`CommonOverrideSection`](./overrideModalSections/CommonOverrideSection.tsx) (zone/CHIRP modal),
and `SatelliteEncodedNameCell` (satellite keps).

**Tracking:** [#1217](https://github.com/pskillen/codeplug-studio/issues/1217)

## Props

| Prop             | Type                                  | Description                                                                                                   |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `committedValue` | `string`                              | Effective override value, `''` when unset — placeholder shows the suggestion                                  |
| `suggestions`    | `{ label?: string; value: string }[]` | One entry per identity for most kinds; channel rows pass one per `ChannelExportNameMode` (ux-proposal.md §6a) |
| `limit`          | `number` (optional)                   | Export name length limit — drives the `error` state and disables Save                                         |
| `disabled`       | `boolean` (optional)                  | e.g. row is skipped from export                                                                               |
| `deferCommit`    | `boolean` (optional)                  | Hides Save/Revert — bulk edit owns persistence via `onDraftChange`                                            |
| `autoFocus`      | `boolean` (optional)                  | Focus the input on mount                                                                                      |
| `onCommit`       | `(value: string) => void`             | Save (non-deferred) — trims and clears the override when empty                                                |
| `onDraftChange`  | `(value: string) => void` (optional)  | Fires on every keystroke/suggestion click — bulk edit accumulates drafts here                                 |
| `onDirtyChange`  | `(dirty: boolean) => void` (optional) | Draft differs from `committedValue`                                                                           |
| `onCancel`       | `() => void` (optional)               | Revert / Escape — lets a read/edit toggle owner collapse back to read state                                   |

## Usage

```tsx
<WireNameInlineEditor
  committedValue={wireNameCommittedValue(row)}
  suggestions={[{ value: row.generatedWireName }]}
  limit={nameLimit}
  disabled={!rowEffectivelyIncluded(row)}
  onCommit={(value) => onWireNameChange(row, value)}
  onCancel={() => setEditing(false)}
/>
```

## Behaviour

- **Suggestions are clickable links that only fill the draft** — never commit or close edit
  state (wire-name-preview SKILL). One suggestion renders as `Suggestion: <link>`; more than one
  renders `label: <link>` pairs separated by `·`.
- Enter saves (non-deferred, not over limit, not disabled); Escape reverts to `committedValue`
  and calls `onCancel`.
- Clearing the field and saving removes the override (`onCommit('')`).
- Over-limit draft gets the Mantine `error` treatment and disables Save.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WireNameRemediationMarker.md](./WireNameRemediationMarker.md)
- [WirePreviewExportNameCell.md](./WirePreviewExportNameCell.md)
- `.claude/skills/wire-name-preview/SKILL.md`
