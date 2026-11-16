# UnusedRanges

"Never read" ranges, folded under a count line.

## Purpose

Lists byte ranges no firmware reader touches so they are not mistaken for settings. Knows no radio.

## Props

| Prop          | Type            | Notes                         |
| ------------- | --------------- | ----------------------------- |
| `ranges`      | `UnusedRange[]` | Start, end, bytes, why        |
| `defaultOpen` | `boolean`       | Default folded                |
| `title`       | `string`        | Default "Never read (unused)" |

## Usage

```tsx
<UnusedRanges ranges={view.unused ?? []} />
```

## Behaviour

- Count line stays visible when folded: "1,203 bytes in 14 ranges are unused (no reader)".
- Renders nothing for an empty list.
- Built on `DebugSection`, so the table is built only when opened.

## Related

- [DebugSection.md](./DebugSection.md)
