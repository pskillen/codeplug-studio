# RadioFoundryMemory

## Purpose

Read-only Memory tab for RadioFoundry debug archives. Decodes the capture through the same RadioFoundry import parser used elsewhere and lists channels, zones, contacts, lists, radio IDs, import notes, and the DMR ID database.

## Props

| Prop         | Type                | Description                                       |
| ------------ | ------------------- | ------------------------------------------------- |
| `archive`    | `DebugArchive`      | Optional open capture.                            |
| `notDecoded` | `readonly string[]` | Unused; kept for the shared Memory tab signature. |

## Usage

```tsx
<RadioFoundryMemory archive={archive} />
```

## Behaviour

Shows a category dropdown (`MemoryCategories`) over parser-decoded inventory. Channels use `identityLabel` (callsign · name). Slot numbers are not shown. The DMR ID database category renders `RadioFoundryIdDatabasePanel`.

## Related

- [Radio debug](../../../../docs/features/radio-debug/README.md)
- [MemoryCategories](../../../components/debug/MemoryCategoryPanel.md)
