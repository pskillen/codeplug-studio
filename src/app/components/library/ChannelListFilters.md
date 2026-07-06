# ChannelListFilters

Band, mode, simplex/split, and distance-radius filters for `/library/channels`. Name/callsign search is on the list `DataTable` only (no duplicate in section nav).

## Usage

```tsx
import ChannelListFilters from '@app/components/library/ChannelListFilters.tsx';

<ChannelListFilters />;
```

## State

Reads and writes via `useChannelListQuery` (URL + per-project `localStorage`). Operator location for distance filtering comes from `useOperatorPosition` — **Show my location** sits above the distance switch; the list page also exposes location controls below the table for the map.

## Related

- `ChannelsListPage.tsx` — hosts filters above the table
- `ChannelsSectionNav.tsx` — add-channel actions only
- [data-table.md](../../../../docs/features/app-shell/data-table.md)
