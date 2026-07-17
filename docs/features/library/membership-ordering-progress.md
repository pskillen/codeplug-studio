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

**Delivered**

- Progress / outstanding pair created
- Plan linked from #456; #155 reinterpretation noted

---

## Slice 1 — Core `Zone.order` + membership helpers + cascade

**Status:** Complete

**Delivered**

- `Zone.order` (schema v20); native-YAML parse; data-model + native-yaml docs
- `zoneOrder.ts` / `membershipOrder.ts` — sort, dense apply, reorder helpers
- `assembleZones` sorts by build `orderOrSlot` → `Zone.order` → name
- `syncZoneGroupingWithLibrary` / seed use library zone order
- `applyDenseOrderOrSlots` generalised from channel helper
- Unit tests in `zoneOrder.test.ts`

**Verify**

- `npm run test -- --run src/core/domain/zoneOrder.test.ts src/core/services/assemble.test.ts`

---

## Next

- Slice 2: Library UI — top-level zone reorder + scan-list member reorder
