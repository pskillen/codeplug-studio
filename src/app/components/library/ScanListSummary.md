# ScanListSummary

## Purpose

Read-only preview of a scan list's members — used on the channel **Scanning** tab below the scan list selector.

## Props

| Prop      | Type             | Description                                     |
| --------- | ---------------- | ----------------------------------------------- |
| `listId`  | `string \| null` | Selected scan list UUID; `null` renders nothing |
| `library` | `Library`        | Project library for list and member resolution  |

## Usage

```tsx
import ScanListSummary from '@app/components/library/ScanListSummary.tsx';

<ScanListSummary listId={scanListId || null} library={library} />;
```

## Behaviour

- Resolves `listId` from `library.scanLists`; missing list shows muted error text.
- Header links to `/library/scan-lists/{id}` for full editing.
- Member table lists channel display labels with links to channel editors.
- Broken member refs show dimmed placeholder IDs.
- Updates live when `listId` changes — no channel save required.

## Related

- [ChannelEditor](../../routes/library/ChannelEditor.tsx) — **Scanning** tab
- [RxGroupListSummary.md](./RxGroupListSummary.md) — parallel pattern for DMR RX group lists
