# MapSheet

Bottom sheet with three snap points (peek / half / full) that floats over a full-screen map on mobile.

## Purpose

Lets a map-first page keep its list, controls or readout in a sheet the user can pull up or push down. A Map | List toggle is just a shortcut for the sheet's snap point: Map snaps to `peek`, List to `full`. Used by the Field tools (Nearby repeaters, Distance & bearing) and, through [ListMapLayout](./ListMapLayout.md), as the controls container over the list | map swipe panes of Channels, Zones and the repeater directory searches (#1498).

## Props

| Prop             | Type                         | Notes                                                                                      |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `snap`           | `'peek' \| 'half' \| 'full'` | Controlled snap point                                                                      |
| `onSnapChange`   | `(snap) => void`             | Fired after a drag settles, a handle tap or an arrow key                                   |
| `header`         | `ReactNode`                  | Always visible under the handle (fills the peek height)                                    |
| `children`       | `ReactNode`                  | Scrollable body, visible from `half` up                                                    |
| `peekPx`         | `number`                     | Height at `peek` in px (default: measured handle + header)                                 |
| `fullTopInsetPx` | `number`                     | Space left above the sheet at `full` (default 84, for map chips)                           |
| `label`          | `string`                     | Accessible name (default `Results`)                                                        |
| `compact`        | `boolean`                    | Slim grab area and one-line header, for a control bar (use with a small `peekPx`, e.g. 56) |
| `backdrop`       | `boolean`                    | Dims the page behind the sheet above `peek`; tapping it collapses to `peek`                |
| `toggleOnTap`    | `boolean`                    | A grabber tap toggles `peek` and `half` instead of cycling all three                       |

## Usage

```tsx
const [snap, setSnap] = useState<MapSheetSnap>('half');

<div style={{ position: 'relative', height: '100%' }}>
  <Map />
  <SegmentedControl
    value={viewForSnap(snap)}
    onChange={(v) => setSnap(snapForView(v as MapListView))}
    options={[
      { value: 'map', label: 'Map' },
      { value: 'list', label: 'List' },
    ]}
  />
  <MapSheet snap={snap} onSnapChange={setSnap} header={<Summary />}>
    <Results />
  </MapSheet>
</div>;
```

## Behaviour

- The parent must be `position: relative` with a definite height; the sheet is absolutely positioned on its bottom edge and measures the parent with a `ResizeObserver`.
- Dragging the handle or the header follows the pointer (a drag that starts on a header button moves the sheet instead of clicking it), then settles on the nearest snap (a fast flick moves one snap further). Tapping the handle cycles peek, half, full; a tap on the header goes to whatever was tapped. The handle is a keyboard-operable slider (ArrowUp / ArrowDown, Enter).
- Snap maths lives in `mapSheetSnap.ts` (`snapHeights`, `snapAfterDrag`, `nextSnap`, `snapForView`, `viewForSnap`) and is unit tested without the DOM.
- At `peek` only the handle and header show; the body is hidden.
- No third-party dependency.

## Related

- [docs/features/field-tools/README.md](../../../../docs/features/field-tools/README.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
