# HexDump

Raw bytes in pages: address, hex, ASCII.

## Purpose

Display-only hex view of captured bytes. Knows no radio.

## Props

| Prop           | Type          | Notes                                                    |
| -------------- | ------------- | -------------------------------------------------------- |
| `sources`      | `HexSource[]` | A Source select appears when there is more than one      |
| `revealed`     | `boolean`     | Sensitive ranges print `••` until true                   |
| `collapseRuns` | `boolean`     | Runs of identical full 16-byte rows collapse to one line |

## Usage

```tsx
<HexDump sources={view.hex} revealed={revealed} collapseRuns />
```

## Behaviour

- 256-byte pages, 16-byte rows, Previous / Next.
- `HexSource.sensitive` ranges are absolute addresses (`address` + offset). Masked bytes show `••` in hex and `•` in ASCII; archives keep every byte.
- Collapsed runs read `0x1000–0x10FF  all FF (256 bytes)`; a row touching a hidden byte never collapses.
- The page owns the Show password control and passes `revealed`.

## Related

- [ValueTable.md](./ValueTable.md)
