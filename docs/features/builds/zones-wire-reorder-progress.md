# Zones wire reorder — progress

**Tracking:** [codeplug-studio#468](https://github.com/pskillen/codeplug-studio/issues/468)
**Plan:** PR1 Build zone export order
**Branch:** `468/pskil/zones-wire-reorder`

---

## Overall status

**Status:** Complete (pending merge)

**Branch:** `468/pskil/zones-wire-reorder`

---

## Fix Zones wire-preview sort

**Status:** Complete

**Delivered**

- `previewWireRows` zone case sorts with `sortZonesByExportOrder(..., build.zoneOverrides)`
- Unit test: `orders zone preview rows by build orderOrSlot overrides`

---

## Custom order indicator

**Status:** Complete

**Delivered**

- `WirePreviewRow.hasOrderOrSlotOverride`
- **Custom order** yellow badge on reorder-enabled wire tables (Build → Zones)

---

## Members per-row arrows + styleguide

**Status:** Complete

**Delivered**

- `SelectedItemList.onMoveItem` + `SelectedItemRowMoveButtons`
- Styleguide lists-and-ordering + membership demo
- Build → Zones → Members tab wired

---

## Documentation

**Status:** Complete

**Delivered**

- `docs/features/builds/wire-preview.md`, `zone-grouping.md`

---

## Next

- Open PR (`Closes #468`); companion work remains on #457 plan
