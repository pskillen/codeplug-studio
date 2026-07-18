# RxGroupListMemberPicker

## Purpose

B+C membership editor for Receive Group Lists — ordered members (**C** `SelectedItemList`) above the add pool (**B** `AvailableItemPicker`), with export order, filters, permanent Sort…, and per-member DMR timeslot override in C row chrome.

## Props

| Prop              | Type                  | Description                            |
| ----------------- | --------------------- | -------------------------------------- |
| `talkGroups`      | `TalkGroup[]`         | Available talk groups                  |
| `digitalContacts` | `DigitalContact[]`    | Available digital contacts             |
| `library`         | `Library`             | Full library (slot visibility rules)   |
| `members`         | `RxGroupListMember[]` | Current ordered members                |
| `onChange`        | `(members) => void`   | Called when membership or slots change |

## Usage

```tsx
import RxGroupListMemberPicker from '@app/components/library/RxGroupListMemberPicker.tsx';

<RxGroupListMemberPicker
  talkGroups={library.talkGroups}
  digitalContacts={library.digitalContacts}
  library={library}
  members={members}
  onChange={setMembers}
/>;
```

## Behaviour

- Vertical stack: **In this list** (C) then **Other talk groups & contacts** (B), each in `PageSection`.
- B sections: Talk groups and Digital contacts (kind badges).
- C rows: drag handle, builtins, `SegmentedControl` (`Auto` / `TS1` / `TS2`) for DMR-relevant members, per-row remove.
- Reorder uses `rxGroupListMemberKey` / `reorderRxGroupListMembersByKeys` so `timeSlotOverride` survives drag.
- Find-in-list filter on C sets `reorderDisabled` (same as Zones).

## Related

- [docs/features/library/rx-group-list-member-picker.md](../../../docs/features/library/rx-group-list-member-picker.md)
- [#107](https://github.com/pskillen/codeplug-studio/issues/107) · [#108](https://github.com/pskillen/codeplug-studio/issues/108) · [#470](https://github.com/pskillen/codeplug-studio/issues/470)
