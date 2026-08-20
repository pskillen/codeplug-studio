# FilterPopover

Anchored floating filter panel — a tab strip over a single chip wall, plus an always-visible footer and a Done button.

## Purpose

Replaces a stacked wall of always-visible filter chip rows with one **Filters** trigger button that opens a popover showing only the active facet's chips at a time. Built for [Channels list filters](../library/ChannelListFilters.md), reusable anywhere a page needs multiple filter facets without dominating the screen.

## Props

| Prop           | Type                        | Notes                                                      |
| -------------- | --------------------------- | ---------------------------------------------------------- |
| `triggerLabel` | `string`                    | Trigger button text, e.g. `"Filters"`                      |
| `opened`       | `boolean`                   | Popover open state (controlled)                            |
| `onOpenChange` | `(opened: boolean) => void` | Fires on trigger click, outside click, Escape, and Done    |
| `activeCount`  | `number`                    | Optional badge shown on the trigger when > 0               |
| `tabs`         | `{ value, label }[]`        | Tab strip options (rendered via `SegmentedControl`)        |
| `activeTab`    | `string`                    | Currently selected tab value                               |
| `onTabChange`  | `(value: string) => void`   | Tab switch handler                                         |
| `children`     | `ReactNode`                 | Active tab's chip-wall content                             |
| `footer`       | `ReactNode`                 | Always-visible content below the tab panel, any active tab |
| `onDone`       | `() => void`                | Optional extra handler fired before the popover closes     |

## Usage

```tsx
<FilterPopover
  triggerLabel="Filters"
  opened={open}
  onOpenChange={setOpen}
  activeCount={activeFilterCount}
  tabs={[
    { value: 'bands', label: 'Bands' },
    { value: 'zones', label: 'Zones' },
    { value: 'modes', label: 'Modes' },
  ]}
  activeTab={tab}
  onTabChange={setTab}
  footer={<SplitFilter options={duplexOptions} value={duplex} onChange={setDuplex} />}
>
  <FacetBar>{/* active tab's chips */}</FacetBar>
</FilterPopover>
```

## Behaviour

- Built on Mantine `Popover` (`withinPortal`, scoped to `.dsv2-scope`) — no bottom-sheet/Drawer fallback on mobile; the dropdown itself goes edge-to-edge (`calc(100vw - 16px)`) at `≤48em` instead of a fixed 440px float.
- The tab strip is a plain v2 `SegmentedControl` — it only picks a value; the caller is responsible for rendering the matching `children` for `activeTab`.
- `footer` renders regardless of which tab is active — use it for filter facets that aren't tab-scoped (e.g. a duplex toggle or distance slider that applies globally).
- Done both invokes `onDone` and closes the popover (`onOpenChange(false)`).

## Related

- [ChannelListFilters.md](../library/ChannelListFilters.md) — first consumer
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
