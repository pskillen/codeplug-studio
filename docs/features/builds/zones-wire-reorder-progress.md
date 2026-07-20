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

---

## Custom order indicator

**Status:** Complete

**Delivered**

- `WirePreviewRow.hasOrderOrSlotOverride`
- **Custom order** yellow badge on reorder-enabled wire tables (Build → Zones)

**Verify**

- `WirePreviewDataTable` test: shows Custom order badge when reorder + override

---

## Next

- Slice 3: Members tab per-row up/down + styleguide
