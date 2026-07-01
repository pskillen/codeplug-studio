# CodeplugMap

## Purpose

Embeddable Leaflet map for plotting library channels and zone hull overlays inside Library page sections. Mode-coloured markers, optional full-name labels, and convex zone hulls.

## Props

| Prop                 | Type                   | Default    | Notes                                                                    |
| -------------------- | ---------------------- | ---------- | ------------------------------------------------------------------------ |
| `channels`           | `Channel[]`            | —          | Channels to plot as markers (after internal filters)                     |
| `zones`              | `Zone[]`               | `[]`       | Zones to draw hulls for when “Draw zones” is on                          |
| `allChannels`        | `Channel[]`            | `channels` | Full channel list for resolving zone member coords                       |
| `height`             | `number \| string`     | `400`      | Map container height (px or CSS value)                                   |
| `showControls`       | `boolean`              | `true`     | Show [`MapControls`](MapControls.tsx) above the map                      |
| `defaultShowLabels`  | `boolean`              | `false`    | Initial state for full-name marker labels                                |
| `defaultShowZones`   | `boolean`              | `true`     | Initial state for zone hull visibility                                   |
| `highlightChannelId` | `string`               | —          | Emphasise one channel marker                                             |
| `operatorPosition`   | `{ lat, lon } \| null` | `null`     | Session operator position — blue **You** marker; included in auto bounds |
| `onChannelClick`     | `(id: string) => void` | —          | Marker popup “Edit channel” action                                       |
| `onZoneClick`        | `(id: string) => void` | —          | Zone popup “Edit zone” action                                            |

## Usage

```tsx
import CodeplugMap from '../components/CodeplugMap/CodeplugMap.tsx';

<CodeplugMap
  channels={library.channels}
  zones={library.zones}
  allChannels={library.channels}
  height={420}
  onChannelClick={(id) => navigate(`/library/channels/${id}`)}
  onZoneClick={(id) => navigate(`/library/zones/${id}`)}
/>;
```

## Behaviour

- **Fixed filters** (not exposed in UI): `useLocation` required, skip `0,0`, merge co-located markers.
- **Tiles:** OpenStreetMap via react-leaflet.
- **Operator marker:** when `operatorPosition` is set, plots a blue **You** marker and includes it in auto bounds.
- **Zone hulls:** circle (1 site), line (2), convex polygon (3+); see [zones.md](../../../../docs/features/map/zones.md).
- **Layout:** defers mount until document layout is ready (`useDocumentLayoutReady`); `ResizeObserver` keeps Leaflet sized in inset layouts.

## Related

- [`MapControls.tsx`](MapControls.tsx) — checkboxes above the map
- [map feature docs](../../../../docs/features/map/README.md)
- Core projection: `src/core/domain/mapProjection.ts`, `geo.ts`, `mapView.ts`
