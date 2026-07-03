# MaidenheadGridLayer

## Purpose

Leaflet overlay that draws Maidenhead locator grid lines and cell labels inside `CodeplugMap`. Viewport-scoped geometry comes from `@core/domain/maidenheadGrid.ts`; styling and label density heuristics live here.

## Props

| Prop   | Type                 | Notes                                       |
| ------ | -------------------- | ------------------------------------------- |
| `mode` | `MaidenheadGridMode` | User max precision: `off`, `4`, `6`, or `8` |

## Usage

```tsx
import MaidenheadGridLayer from './MaidenheadGridLayer.tsx';
import { useMapSettings } from '../../hooks/useMapSettings.ts';

const { maidenheadGrid } = useMapSettings();

<MapContainer>
  <TileLayer … />
  <MaidenheadGridLayer mode={maidenheadGrid} />
  {/* markers and zone hulls above */}
</MapContainer>;
```

## Behaviour

- Recomputes lines and labels on `moveend` / `zoomend`.
- **Lines:** cumulative by level (4, then 6, then 8 when zoom permits). Level 4 solid; 6 dashed; 8 dotted.
- **Labels:** active precision only; indigo text with contrasting glow, centred on cell; omitted when estimated cell width on screen is below ~48px.
- Non-interactive (`interactive={false}`) — does not capture pointer events.
- Rendered below zone hulls and channel markers.

## Related

- [maidenhead-grid.md](../../../../docs/features/map/maidenhead-grid.md)
- [CodeplugMap.md](CodeplugMap.md)
- Core: `src/core/domain/maidenheadGrid.ts`
