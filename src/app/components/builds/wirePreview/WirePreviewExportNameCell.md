## Purpose

Export name cell for the CPS wire-preview table (wire-preview rework phase 6,
ux-proposal.md §2/§3). Read state is a label + [`WireNameRemediationMarker`](./WireNameRemediationMarker.md)

- pencil (`RowActionIcon`, "Edit export name"); the pencil swaps the cell for
  [`WireNameInlineEditor`](./WireNameInlineEditor.md) in place — no modal for a name-only edit.

**Tracking:** [#1217](https://github.com/pskillen/codeplug-studio/issues/1217)

## Props

| Prop               | Type                                              | Description                                                                                                        |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `row`              | `WirePreviewRow`                                  | The preview row being rendered                                                                                     |
| `nameLimit`        | `number` (optional)                               | Export name length limit                                                                                           |
| `disabled`         | `boolean` (optional)                              | Row is effectively excluded from export                                                                            |
| `suggestions`      | `WireNameSuggestion[]`                            | Passed straight through to `WireNameInlineEditor`                                                                  |
| `onWireNameChange` | `(row: WirePreviewRow, wireName: string) => void` | Called on Save                                                                                                     |
| `resolutionFields` | `ResolutionFieldRow[]` (optional)                 | Channel rows only — renders a [`WireResolutionSection`](./WireResolutionSection.md) below the editor while editing |

## Usage

```tsx
<WirePreviewExportNameCell
  row={row}
  nameLimit={nameLimit}
  disabled={!rowEffectivelyIncluded(row)}
  suggestions={wireNameSuggestionsForRow(row, channelsById, nameLimit)}
  onWireNameChange={onWireNameChange}
/>
```

## Behaviour

- Stops click propagation so the pencil/editor never triggers the table row's `onRowActivate`
  (which, on the CPS wire-preview page, only still opens a modal for zone rows).
- Local `editing` state — not lifted; each row edits independently.

## Related

- [WirePreviewDataTable.md](./WirePreviewDataTable.md)
- [WireNameInlineEditor.md](./WireNameInlineEditor.md)
- [WireNameRemediationMarker.md](./WireNameRemediationMarker.md)
- [WireResolutionSection.md](./WireResolutionSection.md)
- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
