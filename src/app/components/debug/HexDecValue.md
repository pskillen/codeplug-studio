# HexDecValue

One number in the owner's number format.

## Purpose

Prints a byte, enum or code as `0x1A (26)` (`0x07D0 (2000)` for two bytes). The caller chooses the format; the component never guesses.

## Props

| Prop     | Type                              | Notes                                                                                                       |
| -------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `value`  | `number \| undefined`             | Undefined prints "Not captured"                                                                             |
| `width`  | `1 \| 2 \| 3 \| 4`                | Bytes, for hex padding. Default 1                                                                           |
| `format` | `'hex-dec' \| 'decimal' \| 'hex'` | Default `hex-dec`. `decimal` for counts, frequencies and physical values (with `unit`); `hex` for addresses |
| `unit`   | `string`                          | Appended to `decimal` output                                                                                |
| `masked` | `boolean`                         | Prints `••` (sensitive, not revealed)                                                                       |

## Behaviour

- Formatting lives in `@integrations/radio-io/debugView` (`formatHexDec`, `formatDecimal`, `formatHex`, `formatNumber`), shared with the table view models (`format` on columns and cells).
- Monospace.

## Related

- [ConfidenceBadge.md](./ConfidenceBadge.md)
- [docs/reference/styleguide/debug-pages.md](../../../../docs/reference/styleguide/debug-pages.md)
