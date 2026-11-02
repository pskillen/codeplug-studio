# FullScreenMapSheet

Full-screen map overlay with a pinned confirm action ([#1498](https://github.com/pskillen/codeplug-studio/issues/1498)).

## Purpose

The destination of a [MapThumbnail](./MapThumbnail.md) on mobile editors: pick a point on a full-height map, then confirm with one clear button ("Use this point"). Keeps long editors short without shrinking the map to a strip.

## Props

| Prop              | Type         | Notes                                                           |
| ----------------- | ------------ | --------------------------------------------------------------- |
| `open`            | `boolean`    | Renders nothing (and mounts no map) while false                 |
| `title`           | `string`     | Top bar title and dialog name                                   |
| `children`        | `ReactNode`  | Live map, fills the sheet (`height="100%"`)                     |
| `onClose`         | `() => void` | Close button and Escape                                         |
| `confirmLabel`    | `string`     | Pinned primary button                                           |
| `onConfirm`       | `() => void` |                                                                 |
| `confirmDisabled` | `boolean`    | Disable until a point has been picked                           |
| `hint`            | `ReactNode`  | Line above the button (picked point, or "Tap the map to pick…") |

## Usage

```tsx
<FullScreenMapSheet
  open={open}
  title="Pick the centre point"
  onClose={() => setOpen(false)}
  confirmLabel="Use this point"
  onConfirm={apply}
  confirmDisabled={!pending}
  hint={pending ? locator(pending) : 'Tap the map to pick a point'}
>
  <CodeplugMap height="100%" onMapClick={(lat, lon) => setPending({ lat, lon })} />
</FullScreenMapSheet>
```

## Behaviour

- Fixed over the whole viewport at `z-index: 2000` (above Leaflet, the sheet and the app chrome). The parent keeps the pending point; nothing is applied until the confirm button is pressed.
- The confirm bar respects the bottom safe-area inset.

## Related

- [docs/features/map/README.md](../../../../docs/features/map/README.md)
- [docs/features/library/README.md](../../../../docs/features/library/README.md)
