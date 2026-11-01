# RadioTargetPicker

Catalog picker for the **New build** page: manufacturer sections, one card per hardware model, firmware variants as radio rows.

## Purpose

Lets the operator find a radio (search, DMR / FM, stock vs mods) and choose the firmware it runs. Data comes from `groupRadioCatalog` in `@core/radio-targets`; the component adds no catalog knowledge of its own.

## Props

| Prop          | Type                              | Notes                                                      |
| ------------- | --------------------------------- | ---------------------------------------------------------- |
| `value`       | `string \| null`                  | Selected radio target id                                   |
| `onChange`    | `(radioTargetId: string) => void` | Called when a supported firmware row is chosen             |
| `buildCounts` | `ReadonlyMap<string, number>`     | Optional; shows "N builds" on rows (`countBuildsByTarget`) |

## Usage

```tsx
<RadioTargetPicker
  value={radioTargetId}
  onChange={setRadioTargetId}
  buildCounts={countBuildsByTarget(builds)}
/>
```

## Behaviour

- Filters: search (manufacturer, model, firmware text), All / DMR / FM only, Any firmware / Stock / Mods & open. Emptied models and manufacturers are hidden.
- Stock is listed for every model; where no export target exists it is disabled and tagged **Not supported**.
- Firmware rows show a Mod / Open pill and the export-route summary (hidden on narrow screens).
- Rows are native radio inputs inside a per-model `radiogroup`, so keyboard and screen readers work.

## Related

- [builds hub](../../../../docs/features/builds/README.md)
- [RadioModelPills](RadioModelPills.md)
