# RadioFoundryIdDatabasePanel

## Purpose

DMR ID database category inside RadioFoundry Memory: header facts, integrity, debounced lookup and a paged record list over captured bytes only.

## Props

| Prop      | Type           | Description                |
| --------- | -------------- | -------------------------- |
| `archive` | `DebugArchive` | Open RadioFoundry capture. |

## Usage

```tsx
<RadioFoundryIdDatabasePanel archive={archive} />
```

## Behaviour

Uses `radioFoundryIdDatabaseView` from the radio home. Format `N` decodes records; format `n` and `C` are described but not decoded. Lookup debounces for about 250 ms and searches only captured records.

## Related

- [RadioFoundryMemory](RadioFoundryMemory.md)
- [RadioFoundry debug capture](../../../../docs/reference/radios/radiofoundry/debug-capture.md)
