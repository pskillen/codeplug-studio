# List kit roles (#460) — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [codeplug-studio#460](https://github.com/pskillen/codeplug-studio/issues/460)

---

## Adoption (in progress on `460/pskil/list-kit-adoption`)

- [x] Refactor `ZoneMemberEditor` onto C built-in move/remove/hotkey props (keep drag + Sort…)
- [x] `ScanListMemberEditor` → `AvailableItemPicker` (B) + C builtins
- [x] Migrate production library/build/import tables to A/B/C/D kit (in-scope surfaces)
- [x] Contacts digital `scale="extreme"` + hideable column storage
- [x] `RepeaterDirectorySearch` / `ChannelSetPicker` / `WirePreviewBulkEditTable` → `DataTable`
- [x] `WirePreviewDataTable` `reorderMode` when reorder config present; delete deprecated `WirePreviewTable`

## Deferred / not planned this PR

- Membership editors temporary display sort — **not planned**; role C stays reorder-mode only (drag shipped in #463). DataTable `storedOrder` remains for hybrid browse lists if needed.
- DataTable row drag handles in `reorderMode` (Zones still uses arrow buttons)
- `RxGroupListMemberPicker` → `SelectedItemList` (later; not Wave 1)
- Indexed search / paging for true ~200k contacts (document only; D path is virtualise + cheap cells)
