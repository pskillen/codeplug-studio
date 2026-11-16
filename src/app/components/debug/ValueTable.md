# ValueTable

Striped table of named values for a debug tab.

## Purpose

Draws a `ValueTableView`: Field (label, group, address, note dimmed) · Value · Raw · Overlay (with an overlay) · Confidence (layout and meaning badges) · Source. Knows no radio.

## Props

| Prop           | Type             | Notes                                             |
| -------------- | ---------------- | ------------------------------------------------- |
| `table`        | `ValueTableView` | Rows and layout                                   |
| `overlay`      | `ValueTableView` | Second read; rows pair by `id`, cells by position |
| `revealed`     | `boolean`        | Sensitive cells print `••` until true             |
| `overlayLabel` | `string`         | Overlay column heading, default "Overlay"         |

## Usage

```tsx
<ValueTable table={view} overlay={other} revealed={revealed} />
```

## Behaviour

- Band layout (`bands: ['VHF','UHF']`) gives one Value, Raw (and Overlay) group per band in the same row.
- Integer `value` cells use `HexDecValue` with the cell's `format`; decoded text prints with its unit.
- Missing cells read "Not captured", never zero or empty.
- Changed overlay cells are amber (`data-changed`), matching compare.
- Phone width (640 px and below): Confidence and Source fold under the field name; the table scrolls in its container.
- The page owns the Show password control (`SensitiveRevealButton` and `useSensitiveReveal`, in this folder) and passes `revealed`.

## Related

- [NumericTable.md](./NumericTable.md), [ConfidenceBadge.md](./ConfidenceBadge.md), [HexDecValue.md](./HexDecValue.md)
