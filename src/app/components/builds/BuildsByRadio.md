# BuildsByRadio

Export for radio list as **radio cards**: manufacturer heading, then one card per radio model listing that model's builds.

## Purpose

Shows where each build lives in the radio catalog and keeps several builds of one radio (a club fleet, Team A / Team B) together. Grouping is derived by `groupBuildsByRadio` (`@core/radio-targets`) from each build's `radioTargetId`; nothing extra is persisted. Search matching lives beside it in `buildsSearch.ts` (`filterBuildsByQuery`, `searchTokens`, `buildTransferPaths`).

## Props

| Prop     | Type                    | Notes                                                    |
| -------- | ----------------------- | -------------------------------------------------------- |
| `builds` | `readonly RadioBuild[]` | Already filtered by the page                             |
| `query`  | `string` (optional)     | Search words; matches are highlighted in names and paths |

## Usage

```tsx
<BuildsByRadio builds={filterBuildsByQuery(builds, query)} query={query} />
```

## Behaviour

- Manufacturer heading (`h2`) with build count; under it a responsive grid (`auto-fill`, 330 px minimum, one column on a phone) of model cards.
- Card header: model label, DMR / FM pill, build count.
- Each build is **one link row** to `/builds/:id/export`, keyboard-focusable. Line one: name and relative updated time ("3 days ago"; the full date is the tooltip). Line two: firmware pill (`FirmwareLabelPill`) and transfer paths.
- Order inside a card: firmware in the model's catalog order (stock first), then name. Models are alphabetical within a manufacturer.
- No Open button and no New build links; the single **New build** button is in the page header.
- Builds whose target is not in the catalog appear under **Other**, with no firmware pill.

## Related

- [builds hub](../../../../docs/features/builds/README.md), [radio catalog](../../../../docs/features/builds/radio-catalog.md)
- [RadioModelPills](RadioModelPills.md), [RadioTargetPicker](RadioTargetPicker.md)
