# NumericTable

The numbers behind a chart, in a striped table that is built only while its fold is open.

## Purpose

Shows a `NumericTableView` (key column plus value columns). Each column prints in its own number format (`hex-dec` `0x1A (26)` by default, `decimal`, `hex`). Knows no radio.

## Props

| Prop           | Type               | Notes                                                            |
| -------------- | ------------------ | ---------------------------------------------------------------- |
| `table`        | `NumericTableView` | The read's table                                                 |
| `overlay`      | `NumericTableView` | Same table from a second read; columns pair by id, rows by index |
| `readLabel`    | `string`           | Sub-heading for the read's values when overlaid                  |
| `overlayLabel` | `string`           | Prefix for the overlay value                                     |
| `defaultOpen`  | `boolean`          | Open on first render; default folded                             |
| `label`        | `string`           | Fold label, default "Numeric table"                              |

## Usage

```tsx
<NumericTable table={chart.table} overlay={other?.table} overlayLabel="Read B" />
```

## Behaviour

- Body is not rendered until the fold opens.
- `Δref +3` under a value when the column has `deltaFromRow` (not on the reference row, which is marked "(ref)").
- With an overlay: a differing cell gets the overlay value and, on its own line, `Δread`, both amber; a cell equal in both reads prints no overlay line.
- Missing values read "Not captured".
- Renders inside `DesignSystemV2Provider`; the table scrolls inside its container.

## Related

- [ValueTable.md](./ValueTable.md), [docs/features/debug/README.md](../../../../docs/features/debug/README.md)
