# MapPanel

Map chrome for live Leaflet maps and hatch placeholder empty states.

## Purpose

Presentational map panel matching the design-system layout: optional title + settings gear, map body, optional legend. Hosts `CodeplugMap`, `MapLocationPicker`, or `MapPairPlot` via `children`; without children, shows a diagonal-hatch placeholder.

## Props

| Prop              | Type         | Notes                                                   |
| ----------------- | ------------ | ------------------------------------------------------- |
| `title`           | `string`     | Optional header label                                   |
| `height`          | `number`     | Map body height in px (default 200)                     |
| `children`        | `ReactNode`  | Live map content; omit for hatch placeholder            |
| `caption`         | `ReactNode`  | Hatch overlay text when no children (default `[ map ]`) |
| `onSettingsClick` | `() => void` | Shows settings `ActionIcon`                             |
| `gearActive`      | `boolean`    | Accent border when settings popover is open             |
| `legend`          | `ReactNode`  | Optional row under the map                              |
| `mapLabel`        | `string`     | `aria-label` for the map region                         |

## Usage

```tsx
// Live library map
<MapPanel title="Library map" height={480} legend={<span>12 channels plotted</span>}>
  <CodeplugMap channels={channels} zones={zones} height="100%" showControls />
</MapPanel>

// Location picker
<MapPanel title="Channel location" height={280}>
  <MapLocationPicker lat={lat} lon={lon} onPick={onPick} height="100%" active />
</MapPanel>

// Empty / styleguide placeholder
<MapPanel title="Channel location" onSettingsClick={() => openSettings()} />
```

## Behaviour

- Without `children`: CSS `repeating-linear-gradient` hatch — not a live map (`role="img"`).
- With `children`: map body uses `mapLive` styles (no hatch, no padding); Leaflet maps should pass `height="100%"`.
- Must render inside `DesignSystemV2Provider`.
- Live demos: `/styleguide/data-display`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
- [docs/features/map/README.md](../../../../docs/features/map/README.md)
