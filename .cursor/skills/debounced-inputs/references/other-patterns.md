# Other debounce patterns (non-default)

Use these when persistence / committed+commit is **not** required.

## Inline filter debounce

Local state + `useDebouncedValue`; debounced value used in `useMemo` for filtering. Input binds to immediate state.

| File | Debounce ms | Notes |
| --- | --- | --- |
| `src/app/components/builds/wirePreview/WirePreviewDataTable.tsx` | 300 (`LIST_NAME_FILTER_DEBOUNCE_MS`) | `pending: search !== debouncedSearch` on DataTable search |
| `src/app/routes/reference/MaidenheadReferencePage.tsx` | 500 (`CHANNEL_SEARCH_DEBOUNCE_MS`) | Autocomplete channel options |
| `src/app/routes/reference/MaidenheadBearingSection.tsx` | 500 | Same |
| `src/app/routes/library/ZoneFromLocationPage.tsx` | 500 | Geolocated channel picker |
| `src/app/components/library/GrowZoneRecommendations.tsx` | 500 | Same |

No `isTypingRef` — nothing external re-hydrates the draft mid-type except parent remount.

## Debounced async fetch

Debounced string triggers network I/O; effect uses cancellation flag.

| File | Debounce ms | Notes |
| --- | --- | --- |
| `src/app/components/library/GeocodeCentreField.tsx` | 400 | `geocodeQuery`; min query length 3 |
| `src/app/routes/tracking/ObserverLocationSettings.tsx` | policy-driven | Nominatim 1 req/s comment |

Do not route these through `useDebouncedNameFilter` — commit callback is wrong abstraction.

## Adding a new text persistence field

If the committed value is a string and you need URL/localStorage/build persistence, **extend or reuse `useDebouncedNameFilter`** rather than duplicating the ref/effect logic.

## Adding a new number persistence field

Reuse `useDebouncedOptionalNumberField`. Map `null` ↔ `undefined` at the boundary if the model uses `null` for empty (`maxNameLength`).
