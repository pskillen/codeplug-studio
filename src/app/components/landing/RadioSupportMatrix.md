# RadioSupportMatrix

"Compare all radios": a table with a row per model, a sub-row per firmware, grouped columns and a legend.

## Props

| Prop   | Type                         | Notes                     |
| ------ | ---------------------------- | ------------------------- |
| `rows` | `readonly SupportModelRow[]` | From `buildSupportMatrix` |

## Usage

```tsx
<RadioSupportMatrix rows={rows} />
```

## Behaviour

- DMR / FM / All filter via `filterSupportMatrix`.
- Program-it feature columns, then a **Channel modes** column group (one column per mode the catalog supports), then Organise / DMR / Firmware as before.
- Feature and mode cells use `SupportCellMark`: support glyph, optional evidence tag (`on air` / `bench` / `unverified`), optional † when a capability depends on the radio's build.
- RadioFoundry firmware rows show the checked commit under the firmware label.
- Four states through `SupportMark`: supported, partial, not supported, not applicable. The state legend and a separate **Evidence** legend sit underneath.
- The wrapper scrolls horizontally with the Radio column sticky; it is keyboard focusable.

## Related

[Onboarding hub](../../../../docs/features/onboarding/README.md).
