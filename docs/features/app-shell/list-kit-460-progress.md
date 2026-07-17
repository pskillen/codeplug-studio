# List kit roles (#460) — progress

**Tracking:** [codeplug-studio#460](https://github.com/pskillen/codeplug-studio/issues/460)  
**Plan:** List kit adoption (#460)  
**Branch:** `460/pskil/list-kit-adoption`

---

## Overall status

**Status:** Complete — production adoption shipped for in-scope surfaces

**Branch:** `460/pskil/list-kit-adoption`

**PR:** _(opened at Slice 6)_

**Prerequisites on main:** [#461](https://github.com/pskillen/codeplug-studio/pull/461) kit + styleguide; [#463](https://github.com/pskillen/codeplug-studio/pull/463) export-ordering toolkit + C drag.

---

## Kit + styleguide (complete)

Shipped in #461 / #463 — not re-done on this branch.

- A/B/C/D kit APIs, nested `/styleguide/*`
- Export ordering: `reorderMode`, `storedOrder`, `SelectedItemList` `onReorder` + drag, `MembershipSortMenu`
- Zones list already on `reorderMode`; zone/scan/wire-preview C drag wired

---

## Adoption

### Slice 0: Branch + progress

**Status:** Complete

**Delivered**

- Branch from post-#463 `main`
- Progress / outstanding adoption section + toolkit note
- list-kit-roles Zones surface → **A + reorderMode**

**Verify**

- Docs reflect toolkit shipped; adoption in progress

### Slice 1: Membership B+C unify

**Status:** Complete

**Delivered**

- `ZoneMemberEditor` → C built-in move/remove/hotkeys; Sort… in toolbar; drag kept
- `ScanListMemberEditor` → `AvailableItemPicker` (B) + C builtins; drag kept
- `ZoneMemberOrderSection` parity confirmed (already on C props + drag)
- Sidecars + zone-member-picker / scan-lists docs

**Verify**

- Zone/scan editors: drag, Move, Alt arrows, Sort…; Scan add via B

### Slice 2: Contacts D

**Status:** Complete

**Delivered**

- Digital contacts `scale="extreme"` + `entityListColumnsKey` hideable cols

### Slice 3: RepeaterDirectorySearch → DataTable

**Status:** Complete

**Delivered**

- Results raw `Table` → embedded `DataTable` (role A); custom select column (existing rows not selectable)

### Slice 4–5: Channel set + wire raw Tables

**Status:** Complete

**Delivered**

- `ChannelSetPicker` preview → embedded `DataTable`
- `WirePreviewBulkEditTable` → embedded `DataTable`
- `WirePreviewDataTable` `reorderMode` when `reorder` config present
- Deleted deprecated `WirePreviewTable`; tests moved to bulk-edit / override modal / `ZoneScanRowHeader`

### Slice 6: Docs + PR

**Status:** Complete

**Delivered**

- list-kit-roles status: Production adoption shipped; surface map updated for wire / repeater / channel-set
- Outstanding adoption boxes cleared; deferred kit gaps remain listed
- Local gate + PR

---

## Next

- Merge PR; follow-ups: DataTable row drag in `reorderMode`; RGL → SelectedItemList (if scheduled)
