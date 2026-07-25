## Purpose

Toolbar menu for **flat-memory** build Channels. Copies memory location order from another same-project `FlatMemoryList` build by matching library channel UUIDs.

## Props

| Prop             | Type                                                              | Description                                      |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| `builds`         | `RadioBuild[]`                                                    | Eligible source builds (current build excluded)  |
| `disabled`       | `boolean` (optional)                                              | Disables menu (e.g. filter active, no peers)     |
| `confirmMessage` | `(source, stats) => string`                                       | Confirm dialog body before apply                 |
| `resolveStats`   | `(sourceBuildId) => CopyOrderFromBuildStats \| null`              | Match/unmatch counts for confirm copy            |
| `onCopy`         | `(sourceBuildId: string) => void`                                 | Apply projected order after confirm              |

## Behaviour

- Lists builds grouped by radio-target family (`radioTargetFor(...).group`), sorted by build name within each group.
- On item click: resolves stats, shows `window.confirm`, then calls `onCopy`.
- Disabled when `builds` is empty or `disabled` is true.
- Does not persist — callers project order and write `orderOrSlot` via `applyDenseChannelOrderOrSlots`.

## Usage

```tsx
<CopyOrderFromBuildMenu
  builds={eligibleSourceBuilds}
  disabled={reorderBlocked}
  confirmMessage={(source, stats) =>
    buildCopyOrderFromBuildConfirmMessage(source.name, stats.matchedCount, stats.unmatchedCount)
  }
  resolveStats={(sourceId) => {
    const source = eligibleSourceBuilds.find((b) => b.id === sourceId);
    if (!source) return null;
    const { matchedCount, unmatchedCount } = projectFlatMemoryOrderFromSource(
      chirpMemoryChannelIds(source, librarySlice),
      memoryChannelIds,
    );
    return { matchedCount, unmatchedCount };
  }}
  onCopy={(sourceId) => {
    const source = eligibleSourceBuilds.find((b) => b.id === sourceId);
    if (!source) return;
    const { orderedIds } = projectFlatMemoryOrderFromSource(
      chirpMemoryChannelIds(source, librarySlice),
      memoryChannelIds,
    );
    setChannelOrder(orderedIds);
  }}
/>
```

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [`BuildFlatMemoryChannelsPage`](../../../routes/builds/BuildFlatMemoryChannelsPage.tsx)
- [`projectFlatMemoryOrderFromSource`](../../../../src/core/domain/exportOrderOrSlot.ts)
