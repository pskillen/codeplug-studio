# ContextualStrip

Section sub-view pill strip — typically directly under `AppShell`.

## Purpose

Matches the design-system Library strip (Channels / Zones / …). Solid accent fill on the active pill.

## Props

| Prop       | Type                     | Notes             |
| ---------- | ------------------------ | ----------------- |
| `items`    | `readonly string[]`      | Pill labels       |
| `active`   | `string`                 | Selected label    |
| `onChange` | `(item: string) => void` | Selection handler |

## Usage

```tsx
<ContextualStrip items={['Channels', 'Zones', 'Talk groups']} active={sub} onChange={setSub} />
```

## Related

- [AppShell.md](./AppShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
