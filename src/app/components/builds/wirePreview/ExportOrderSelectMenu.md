## Purpose

Toolbar menu for **flat-memory** build channel export-order lists. Helps operators select coherent subsets (by band or FM/AM mode) before drag or **Move** toolbar actions.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `orderedChannelIds` | `readonly string[]` | Canonical export-order channel ids |
| `channelById` | `ReadonlyMap<string, Channel>` | Library channels for attribute lookup |
| `selectedKeys` | `readonly string[]` | Current table selection |
| `onSelectedKeysChange` | `(keys: string[]) => void` | Selection updater |
| `disabled` | `boolean` (optional) | Disables menu (e.g. filter active) |

## Behaviour

- **Select by band** — toggles all channels whose RX/TX classify to that band (`bandsFromFrequencies`).
- **Select by mode** — toggles FM or AM channels via `pickFmAmModeProfile`.
- **Clear selection** — empties selection.
- Toggle semantics: if every channel in the group is already selected, clicking removes them; otherwise adds the group.

## Usage

```tsx
<ExportOrderSelectMenu
  orderedChannelIds={memoryChannelIds}
  channelById={channelById}
  selectedKeys={reorderSelectedKeys}
  onSelectedKeysChange={setReorderSelectedKeys}
  disabled={reorderBlocked}
/>
```

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WirePreviewDataTable.md](./WirePreviewDataTable.md)
- [`BuildFlatMemoryChannelsPage`](../../../routes/builds/BuildFlatMemoryChannelsPage.tsx)
