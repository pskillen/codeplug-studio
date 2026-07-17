# Membership ordering — progress

**Tracking:** [codeplug-studio#456](https://github.com/pskillen/codeplug-studio/issues/456) · [codeplug-studio#155](https://github.com/pskillen/codeplug-studio/issues/155)
**Plan:** `.cursor/plans/membership_ordering_456_9d594662.plan.md`
**Branch:** `456/pskil/membership-ordering`

---

## Overall status

**Status:** In progress

**Branch:** `456/pskil/membership-ordering`

---

## Slice 0 — Kickoff

**Status:** Complete

---

## Slice 1 — Core `Zone.order` + membership helpers + cascade

**Status:** Complete

---

## Slice 2 — Library UI (zones + scan lists)

**Status:** Complete

**Delivered**

- `ZonesListPage` — export-order column with Move up/down → dense `Zone.order`
- `ScanListMemberEditor` — SelectedItemList + Move up/down; sidecar + scan-lists docs
- Library hub route row updated

**Verify**

- `/library/zones` reorder (no name filter)
- `/library/scan-lists/:id` member Move up/down + save

---

## Next

- Slice 3: Library Sort… (#155) with confirm; open follow-up issue
