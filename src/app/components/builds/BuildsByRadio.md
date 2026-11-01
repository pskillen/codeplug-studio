# BuildsByRadio

Export for radio list grouped **manufacturer → model → firmware → build instances**.

## Purpose

Shows where each build lives in the radio catalog and keeps several builds of one target (a club fleet, Team A / Team B) together. Grouping is derived by `groupBuildsByRadio` (`@core/radio-targets`) from each build's `radioTargetId`; nothing extra is persisted.

## Props

| Prop     | Type                    | Notes                 |
| -------- | ----------------------- | --------------------- |
| `builds` | `readonly RadioBuild[]` | Already name-filtered |

## Usage

```tsx
<BuildsByRadio builds={filtered} />
```

## Behaviour

- Manufacturer and model rows are collapsible (`aria-expanded`); **Collapse all / Expand all** toggles every one.
- Model header: class pill, build count ("N builds on M firmwares" when several).
- Firmware sub-header (label + Stock / Mod / Open pill + count) appears when a model has several firmware groups or a non-stock one.
- Build row: name link, export-route summary, updated time, **Open**. On narrow screens the updated column is hidden.
- New build shortcuts link to `/builds/new?target=<radioTargetId>`: a header **+ New** for models with one exportable firmware, otherwise a **+ Another <firmware> build** row per firmware group.
- Builds whose target is not in the catalog appear under **Other**.

## Related

- [builds hub](../../../../docs/features/builds/README.md)
- [RadioModelPills](RadioModelPills.md), [RadioTargetPicker](RadioTargetPicker.md)
