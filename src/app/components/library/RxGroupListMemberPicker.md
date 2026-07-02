# RxGroupListMemberPicker

## Purpose

Two-list editor for RX group list membership — talk groups and digital contacts with export order, filters, and per-member DMR timeslot override.

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

- Unified available pool sorted by name; kind badges distinguish talk groups from digital contacts.
- In-list panel shows `SegmentedControl` (`Auto` / `TS1` / `TS2`) only for DMR-relevant members.
- Selection and reorder use `entityRefKey(ref)` — slot changes do not alter row identity.

## Related

- [docs/features/library/rx-group-list-member-picker.md](../../../docs/features/library/rx-group-list-member-picker.md)
- [#107](https://github.com/pskillen/codeplug-studio/issues/107) · [#108](https://github.com/pskillen/codeplug-studio/issues/108)
