# ChannelListFilters

Band, mode, simplex/split, zone membership, and distance-radius filters for `/library/channels`. Name/callsign search is a page-level field in `ChannelsListPage` (shared by table and card layouts, not `DataTable`'s own toolbar search) — no duplicate in section nav.

## Usage

```tsx
import ChannelListFilters from '@app/components/library/ChannelListFilters.tsx';

<ChannelListFilters />;
```

## State

Reads and writes via `useChannelListQuery` (URL + per-project `localStorage`). Operator location for distance filtering comes from `useOperatorPosition` — **Show my location** sits above the distance switch; the list page also exposes location controls below the list for the map.

**Zone facet:** **All zones** clears the filter. **Not in a zone** toggles the `none` sentinel (direct membership only — same rule as the Zones column). Individual zone chips toggle zone ids; multi-select is OR semantics (channel matches if it belongs to any selected zone or matches **Not in a zone** when that chip is active).

## Related

- `ChannelsListPage.tsx` — hosts filters above the list
- `ChannelsSectionNav.tsx` — add-channel actions only
- [docs/features/library/README.md](../../../../docs/features/library/README.md#channels-list-24)
- [data-table.md](../../../../docs/features/app-shell/data-table.md)
