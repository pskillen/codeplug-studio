# LibraryMapStack

C7 map + list composition helper for library inventory routes.

## Purpose

Wraps list content and a `MapPanel` child in stacked or split layouts, with an optional mobile **Show map** / **Hide map** toggle so the list keeps the viewport on narrow screens.

## Props

| Prop              | Type                   | Notes                                                 |
| ----------------- | ---------------------- | ----------------------------------------------------- |
| `layout`          | `'stacked' \| 'split'` | Split applies at desktop; narrow always stacks        |
| `list`            | `ReactNode`            | Table + facets above the map                          |
| `map`             | `ReactNode`            | Usually `MapPanel` with `CodeplugMap` children        |
| `mobileMapToggle` | `boolean`              | Default `true` — collapse map on mobile until toggled |

## Usage

```tsx
<LibraryMapStack
  layout="stacked"
  list={<DataTable … />}
  map={
    <MapPanel title="Channel locations" height={420}>
      <CodeplugMap … />
    </MapPanel>
  }
/>
```

## Related

- [MapPanel.md](../../v2/MapPanel.md)
- [docs/features/map/README.md](../../../../docs/features/map/README.md)
