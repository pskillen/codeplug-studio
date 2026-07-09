# DataTable and entity list prefs

Deep dive for the reusable **`DataTable`** list primitive and the hooks/storage that back library entity list pages.

See the [app-shell hub](README.md) for routes and section nav. List-route behaviour and per-entity columns are summarised in [library — List routes](../library/README.md#list-routes).

**Tracking:** [#20](https://github.com/pskillen/codeplug-studio/issues/20), [#24](https://github.com/pskillen/codeplug-studio/issues/24), [#51](https://github.com/pskillen/codeplug-studio/issues/51), [#68](https://github.com/pskillen/codeplug-studio/issues/68)

## Purpose

Ported from [codeplug-tool](https://github.com/pskillen/codeplug-tool) `DataTable`. Provides sortable tabular lists with an optional toolbar search, hideable optional columns (channels), row selection (future), and empty states. All library **list routes** use `variant="list"` except embedded pickers (not yet shipped here).

## Code anchors

| Symbol                                         | Path                                                     | Role                                                      |
| ---------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `DataTable`                                    | `src/app/components/ui/DataTable.tsx`                    | Mantine `Table` wrapper — sort, search, column visibility |
| `useDataTableColumnVisibility`                 | `src/app/hooks/useDataTableColumnVisibility.ts`          | Persist hideable column keys (channels)                   |
| `useListNameQuery`                             | `src/app/hooks/useListNameQuery.ts`                      | URL + `localStorage` name filter per entity list          |
| `useDebouncedNameFilter`                       | `src/app/hooks/useDebouncedNameFilter.ts`                | Draft vs committed name search (300 ms)                   |
| `usePersistedEntityListSort`                   | `src/app/hooks/usePersistedEntityListSort.ts`            | Per-project column sort for entity lists                  |
| `useChannelListQuery`                          | `src/app/hooks/useChannelListQuery.ts`                   | Channels-only filters (band, mode, distance, …)           |
| `filterRowsByName`                             | `useListNameQuery.ts`                                    | Client-side name substring filter                         |
| `referenceCount` / `formatReferenceCount`      | `src/app/lib/listReferences.ts`                          | Reference-count cells via `findReferencesTo` (core)       |
| `EntityListDeleteAction`                       | `src/app/components/library/EntityListDeleteAction.tsx`  | Row trash icon — generic delete flow                      |
| `ChannelListDeleteAction`                      | `src/app/components/library/ChannelListDeleteAction.tsx` | Channels row delete (zone cascade)                        |
| `sortDataTableRows`, `DATATABLE_NAME_SORT_KEY` | `src/app/lib/dataTable/sort.ts`                          | Sort state helpers                                        |
| List prefs storage                             | `src/integrations/listPrefs/`                            | `localStorage` keys, load/save/merge                      |
| List prefs URL sync                            | `src/app/lib/listPrefs/urlSync.ts`                       | URL ↔ prefs mapping (app layer)                           |

Dev demos: `/styleguide` (unlinked).

## DataTable props (list pages)

| Prop                        | Typical use                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| `variant="list"`            | Full-width library list (toolbar search shown)                                                 |
| `rows` / `totalRowCount`    | Filtered rows + unfiltered count for “showing N of M”                                          |
| `nameColumn`                | Linked name cell → editor route (`getName`, `getPath`)                                         |
| `callsignColumn`            | Channels only — sortable callsign link                                                         |
| `columns`                   | Extra sortable columns (`sortValue` required when sortable)                                    |
| `sort` / `onSortChange`     | Controlled sort; wire to persisted hooks                                                       |
| `search` / `onSearchChange` | Full-width toolbar name filter — bind **`nameFilterInput`** / `setNameFilter` from query hooks |
| `searchPending`             | Show Mantine `Loader` while draft input ≠ committed filter                                     |
| `columnVisibility*`         | Channels optional columns — **Show/hide cols** opens a modal with checkboxes                   |
| `toolbar`                   | Actions rendered **below** the table (e.g. **New zone from selected** on channels)             |

List layout: full-width search → result count row (with optional column picker button) → table → footer toolbar.

Rows link to editors via `nameColumn.getPath`. Optional trailing **actions** column (`hideable: false`) hosts list delete icons — see [EntityListDeleteAction](../../src/app/components/library/EntityListDeleteAction.md) (channels: [ChannelListDeleteAction](../../src/app/components/library/ChannelListDeleteAction.md)).

## Entity list pages

| Route                         | `EntityListEntity` | URL name param      | Default sort key | Notable columns                                            |
| ----------------------------- | ------------------ | ------------------- | ---------------- | ---------------------------------------------------------- |
| `/library/channels`           | _(channels prefs)_ | `q` (+ band/mode/…) | name or distance | See [channels list](../library/README.md#channels-list-24) |
| `/library/zones`              | `zones`            | `q`                 | name             | Members, comment, actions (delete)                         |
| `/library/talk-groups`        | `talk-groups`      | `q`                 | name             | Mode, ID, channels/RX lists using, comment, actions        |
| `/library/contacts` (digital) | `digital-contacts` | `dq`                | name             | Mode, ID, channels using, actions                          |
| `/library/contacts` (analog)  | `analog-contacts`  | `aq`                | name             | Code, channels using, actions                              |
| `/library/rx-group-lists`     | `rx-group-lists`   | `q`                 | name             | Members, channels using, actions                           |

Digital and analog contact tables on `/library/contacts` use **separate** URL params (`dq`, `aq`) so filters do not collide.

## Debounced name search

List name filters use a **draft** vs **committed** split ([`useDebouncedNameFilter`](../../../src/app/hooks/useDebouncedNameFilter.ts)):

- **`nameFilterInput`** — immediate value for the `TextInput` / `DataTable` search field.
- **`nameFilter`** — committed value from URL params; drives `filterRowsByName` / `useFilteredChannels`.
- **`nameFilterPending`** — `true` while the operator is typing and the debounce has not settled.

Debounce interval: **`LIST_NAME_FILTER_DEBOUNCE_MS` (300)** in [`src/integrations/listPrefs/constants.ts`](../../../src/integrations/listPrefs/constants.ts). URL, `localStorage`, and table filtering all commit on the same schedule. Non-text channel filters (band, mode, duplex, distance, sort) remain immediate.

## Browser storage

Prefix: `mm9pdy-codeplug-studio.list.` (`LIST_PREFS_STORAGE_PREFIX` in [`src/integrations/listPrefs/keys.ts`](../../../src/integrations/listPrefs/keys.ts)).

| Key pattern                    | Contents                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `channels.{projectId}`         | Channel filters + `columnSort`                                                                                   |
| `channels.{projectId}.columns` | Hideable column visibility                                                                                       |
| `{entity}.{projectId}`         | Entity list `q` + `columnSort` (`zones`, `talk-groups`, `digital-contacts`, `analog-contacts`, `rx-group-lists`) |

Name filters sync to URL query params when committed; on first visit without URL params, stored prefs hydrate the URL (`replace: true`). `localStorage` writes happen on commit (not every keystroke).

Never commit operator values from browser storage.

## Reference-count columns

`listReferences.ts` wraps `findReferencesTo` from `src/core/domain/references.ts` — vendor-neutral UUID targets only. Talk-group “RX lists using” counts RX group list members that reference the talk group (not channel references).

## Manual verify

1. Open `/library/zones` — sort by Members; reload — sort persists.
2. Filter talk groups by name — type rapidly; input stays responsive; spinner shows briefly; table updates after ~300 ms; URL gains `?q=`; reload — filter persists.
3. On `/library/contacts`, set digital and analog filters independently — URL shows `dq` and `aq`; each debounces separately.
4. Channels: list-page filters + `DataTable` search; optional columns hide/show; distance filter requires operator location (**Show my location** below the table).

## Known gaps

- Row selection and bulk actions ship on the channels list only ([#154](https://github.com/pskillen/codeplug-studio/issues/154), [#207](https://github.com/pskillen/codeplug-studio/issues/207), [#310](https://github.com/pskillen/codeplug-studio/issues/310)); other entity lists have no multi-select yet.
- Channels optional-column set is a subset of codeplug-tool parity — extend as needed.
- `mobileColumnPolicy: 'collapse'` is reserved — only `none` is implemented.
- Section nav name filters for non-channel lists are toolbar-only today (URL still syncs via `useListNameQuery`).

## Related

- [library/README.md](../library/README.md) · [zone-member-picker.md](../library/zone-member-picker.md)
- [library-routes-progress.md](library-routes-progress.md)
- [map](../map/README.md) — map embed on channels/zones list routes
