# Zones wire reorder — progress

**Tracking:** [codeplug-studio#468](https://github.com/pskillen/codeplug-studio/issues/468)
**Plan:** PR1 Build zone export order
**Branch:** `468/pskil/zones-wire-reorder`

---

## Overall status

**Status:** In progress

**Branch:** `468/pskil/zones-wire-reorder`

---

## Fix Zones wire-preview sort

**Status:** Complete

**Delivered**

- `previewWireRows` zone case sorts with `sortZonesByExportOrder(..., build.zoneOverrides)`
- Unit test: `orders zone preview rows by build orderOrSlot overrides`

**Verify**

- `npx vitest run src/core/services/previewWireRows.test.ts -t "orders zone preview"`

---

## Next

- Slice 2: per-row custom-order indicator on Build → Zones
