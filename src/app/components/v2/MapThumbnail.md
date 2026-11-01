# MapThumbnail

Small read-only map that opens a full-screen map when tapped ([#1498](https://github.com/pskillen/codeplug-studio/issues/1498)).

## Purpose

On mobile, long editors fold into sections; the map becomes a 140 px thumbnail so the page stays short. Tapping opens a [FullScreenMapSheet](./FullScreenMapSheet.md).

## Props

| Prop       | Type         | Notes                                                     |
| ---------- | ------------ | --------------------------------------------------------- |
| `children` | `ReactNode`  | Live map; non-interactive here, its own toolbar is hidden |
| `label`    | `string`     | Accessible name and caption of the open button            |
| `onOpen`   | `() => void` |                                                           |

## Usage

```tsx
<MapThumbnail label="Open map to pick the centre" onOpen={openPicker}>
  <CodeplugMap height="100%" referencePosition={centre} />
</MapThumbnail>
```

## Behaviour

- The map is `pointer-events: none` and `aria-hidden`; one full-size button covers it.

## Related

- [docs/features/map/README.md](../../../../docs/features/map/README.md)
