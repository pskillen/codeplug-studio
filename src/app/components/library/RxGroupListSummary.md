# RxGroupListSummary

## Purpose

Read-only preview of an RX group list's members — used on the channel DMR tab below the RX group list selector.

## Props

| Prop      | Type             | Description                                         |
| --------- | ---------------- | --------------------------------------------------- |
| `listId`  | `string \| null` | Selected RX group list UUID; `null` renders nothing |
| `library` | `Library`        | Project library for list and member resolution      |

## Usage

```tsx
import RxGroupListSummary from '@app/components/library/RxGroupListSummary.tsx';

<RxGroupListSummary listId={profile.rxGroupListId} library={library} />;
```

## Behaviour

- Resolves `listId` from `library.rxGroupLists`; missing list shows muted error text.
- Header links to `/library/rx-group-lists/{id}` for full editing.
- Member table: name, kind, digital ID, timeslot override (`—` / `TS1` / `TS2`).
- Broken member refs show dimmed placeholder names.
- Updates live when `listId` changes — no channel save required.

## Related

- [ChannelModeProfilesEditor.md](../channels/ChannelModeProfilesEditor.md)
- [#75](https://github.com/pskillen/codeplug-studio/issues/75)
