# ContextualStrip

Section sub-view tab strip — typically directly under `AppShell`.

## Purpose

The section's own navigation (Channels / Zones / …). A raised bar with a shadow, an accent section label (e.g. **TOOLS**) before the tabs, optional icons, and an accent underline on the active tab, so it reads as separate from the main toolbar (#1472). Horizontally scrollable at any width; the section label hides below 768px.

## Props

| Prop           | Type                              | Notes                                                   |
| -------------- | --------------------------------- | ------------------------------------------------------- |
| `items`        | `readonly ContextualStripEntry[]` | Labels, or `{ label, icon?, external? }`                |
| `active`       | `string`                          | Selected label                                          |
| `onChange`     | `(item: string) => void`          | Selection handler                                       |
| `leading`      | `ReactNode`                       | Optional leading control before tabs (e.g. build chip)  |
| `sectionLabel` | `{ label, icon? }`                | Section name before the tabs when there is no `leading` |

## Usage

```tsx
<ContextualStrip
  items={['Channels', 'Zones', 'Talk groups']}
  active={sub}
  onChange={setSub}
  leading={isBuildDetail ? <BuildStripLeading buildId={buildId} /> : undefined}
/>
```

## Related

- [AppShell.md](./AppShell.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
