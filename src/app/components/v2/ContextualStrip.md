# ContextualStrip

Section sub-view pill strip — typically directly under `AppShell`.

## Purpose

Matches the design-system Library strip (Channels / Zones / …). Solid accent fill on the active pill. Horizontally scrollable at any width.

## Props

| Prop       | Type                     | Notes                                                 |
| ---------- | ------------------------ | ----------------------------------------------------- |
| `items`    | `readonly string[]`      | Pill labels                                           |
| `active`   | `string`                 | Selected label                                        |
| `onChange` | `(item: string) => void` | Selection handler                                     |
| `leading`  | `ReactNode`              | Optional leading control (e.g. compact BuildSwitcher) |

## Usage

```tsx
<ContextualStrip
  items={['Channels', 'Zones', 'Talk groups']}
  active={sub}
  onChange={setSub}
  trailing={isBuildDetail ? <BuildStripLeading buildId={buildId} /> : undefined}
/>
```

## Related

- [AppShell.md](./AppShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
