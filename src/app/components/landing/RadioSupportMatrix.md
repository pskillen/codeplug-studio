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
- Four states through `SupportMark`: supported, partial, not supported, not applicable. The legend underneath explains them.
- The wrapper scrolls horizontally with the Radio column sticky; it is keyboard focusable.

## Related

[Onboarding hub](../../../../docs/features/onboarding/README.md).
