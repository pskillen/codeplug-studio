# Summary

Read-only summary view over the active project's library. Gives operators an at-a-glance inventory (counts, mode/band breakdowns) and surfaces **integrity warnings** for foreign keys that no longer resolve, without mutating anything.

**Tracking:** Phase 2 [#12](https://github.com/pskillen/codeplug-studio/issues/12) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)) · shipped in [PR #15](https://github.com/pskillen/codeplug-studio/pull/15) · route renamed in [#23](https://github.com/pskillen/codeplug-studio/issues/23)

**Source:** `src/app/routes/SummaryPage.tsx`, `src/core/domain/summary.ts`

## Implementation status

| Area                  | Status   | Notes                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------- |
| Entity counts         | Shipped  | Channels, talk groups, digital/analog contacts, RX group lists, zones |
| Channels by mode      | Shipped  | From the first `modeProfiles` entry per channel                       |
| Channels by band      | Shipped  | Via `bandLabelForFrequencyHz` on RX frequency                         |
| Located-channel count | Shipped  | Links to the [library channels map section](../map/README.md)         |
| Integrity warnings    | Shipped  | Dangling UUID references (`findDanglingReferences`)                   |
| Export / print report | Deferred | No report export yet                                                  |

## Concepts

`summariseLibrary(library)` (`src/core/domain/summary.ts`) is a pure projection returning counts, `channelsByMode`, `channelsByBand`, `channelsWithLocation`, and `danglingReferences`. The page is a thin read-only Mantine view — all computation is vendor-neutral `core` domain logic; there are no mutations and no persistence writes.

**Integrity warnings** come from `findDanglingReferences` (`src/core/domain/references.ts`): a foreign key (zone member, RX-group-list member, or channel DMR `contactRef` / `rxGroupListId`) whose target `id` is missing from the library. Reported as `<fromKind> "<name>" references a missing <targetKind>`.

## Documentation map

| Doc                                         | Role                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| [library](../library/README.md)             | Entities summarised here; delete-blocking uses the same reference scan |
| [bands reference](../../reference/bands.md) | Band lookup shares `bandPlan` (also on `/reference`)                   |
| [data-model](../data-model/README.md)       | Entity shapes and UUID FK rules                                        |

## Manual verify

1. Open a project with a few channels, talk groups, and a zone (or import via [repeater directories](../repeater-directories/README.md)).
2. Visit `/summary` — counts and the mode/band breakdowns match the library.
3. Confirm "Integrity warnings" reads "No dangling references" for a consistent library.

## Known gaps

- No report export/print.
- Breakdowns use the first mode profile only (multi-mode channels — see [#16](https://github.com/pskillen/codeplug-studio/issues/16)).
