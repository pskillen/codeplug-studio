# ChannelListFilters

Band, mode, simplex/split, zone membership, and distance-radius filters for `/library/channels`, presented as a tabbed [FilterPopover](../v2/FilterPopover.md). Name/callsign search is a page-level field in `ChannelsListPage` (shared by table and card layouts, not `DataTable`'s own toolbar search) — no duplicate in section nav.

## Usage

```tsx
import ChannelListFilters, {
  ChannelListAppliedFilters,
} from '@app/components/library/ChannelListFilters.tsx';

<ChannelListFilters />
<ChannelListAppliedFilters />;
```

Two exports, composed as siblings by `ChannelsListPage` alongside `UseMyLocationButton` and the Cards/Table view switch, so mobile can reorder them independently (Filters → view switch → Use my location, each full width) while desktop keeps Filters and Use my location adjacent with the view switch pushed right.

- **Default export** — the **Filters** trigger button + popover. Bands/Zones/Modes are tabs (one chip wall visible at a time); Simplex/Split and the distance-radius slider sit in the popover footer, visible regardless of the active tab. The trigger shows a count badge when any filter is active.
- **`ChannelListAppliedFilters`** — a removable pill row (one pill per active band/zone/mode, one for duplex, one for the distance toggle) rendered below the row. Stays visible even when the popover is closed, so active filters never hide silently. Renders nothing when no filter is active.

## State

Reads and writes via `useChannelListQuery` (URL + per-project `localStorage`). Operator location for distance filtering comes from `useOperatorPosition`; `ChannelsListPage` — not this component — renders `UseMyLocationButton`, since its position in the row differs between desktop and mobile.

**Zone facet:** **All zones** clears the filter. **Not in a zone** toggles the `none` sentinel (direct membership only — same rule as the Zones column). Individual zone chips toggle zone ids; multi-select is OR semantics (channel matches if it belongs to any selected zone or matches **Not in a zone** when that chip is active).

## Related

- [FilterPopover.md](../v2/FilterPopover.md) — the popover shell this component composes
- `ChannelsListPage.tsx` — hosts the filter row, applied pills, view switch, and location button
- `ChannelsSectionNav.tsx` — add-channel actions only
- [docs/features/library/README.md](../../../../docs/features/library/README.md#channels-list-24)
- [data-table.md](../../../../docs/features/app-shell/data-table.md)
