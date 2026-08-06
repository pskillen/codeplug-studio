# LibraryInventoryHeader

Shared page header for library inventory list routes (L1 pattern).

## Purpose

Title + optional count/description subtitle + primary action cluster for Batch 2 library lists.

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `title` | `string` | Page heading |
| `subtitle` | `ReactNode` | Count line or short description |
| `actions` | `ReactNode` | Primary/secondary buttons |

## Usage

```tsx
<LibraryInventoryHeader
  title="Scan lists"
  subtitle="3 scan lists in this project"
  actions={<Button variant="primary">New scan list</Button>}
/>
```

## Related

- [docs/features/library/README.md](../../../../docs/features/library/README.md)
- [LibraryMapStack.md](./LibraryMapStack.md)
