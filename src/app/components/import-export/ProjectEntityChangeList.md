# ProjectEntityChangeList

Itemised list of entity changes (Added / Removed / Changed) between two project copies.

## Props

| Prop           | Type                    | Notes                                    |
| -------------- | ----------------------- | ---------------------------------------- |
| `changes`      | `ProjectEntityChange[]` | From `projectEntityDiff.ts`              |
| `emptyMessage` | `string`                | Shown instead of the list when no change |

## Behaviour

- One row per entity: pill, kind, name. 8 rows by default, **Show all N changes** toggle for the rest.
- Matching is by UUID in core; the name is a display label only.
- Direction comes from the caller: `InterchangeOverwriteModal` passes changes as if adopting the other copy, `DriveOutgoingChangesModal` passes them inverted (what saving does to Drive).

## Related

- `InterchangeOverwriteModal`, `DriveOutgoingChangesModal`
