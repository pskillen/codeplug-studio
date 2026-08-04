# MapPanel

Map chrome with a diagonal-hatch placeholder (real map wiring deferred).

## Purpose

Presentational map panel matching the design-system layout: optional title + settings gear, hatch placeholder, optional legend. Real `CodeplugMap` integration is [#925](https://github.com/pskillen/codeplug-studio/issues/925).

## Props

| Prop              | Type         | Notes                            |
| ----------------- | ------------ | -------------------------------- |
| `title`           | `string`     | Optional header label            |
| `onSettingsClick` | `() => void` | Shows settings `ActionIcon`      |
| `legend`          | `ReactNode`  | Optional row under the map       |
| `mapLabel`        | `string`     | `aria-label` for the placeholder |

## Usage

```tsx
<MapPanel
  title="Channel location"
  onSettingsClick={() => openSettings()}
  legend={<span>2m · 70cm</span>}
/>
```

## Behaviour

- Placeholder uses CSS `repeating-linear-gradient` hatch — not a live map.
- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/v2/data-display`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
- Ticket [#925](https://github.com/pskillen/codeplug-studio/issues/925)
