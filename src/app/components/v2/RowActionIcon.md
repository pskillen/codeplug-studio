# RowActionIcon

Small icon-only row action button for `DataTable` rows and `MembershipRow` trailing controls.

## Purpose

The compact per-row edit/delete/open affordance used inside table and list rows. Isolates its click from any parent row-activate handler so an icon click never also opens the row.

## Props

| Prop        | Type                         | Notes                            |
| ----------- | ---------------------------- | -------------------------------- |
| `icon`      | `ReactNode`                  | Icon element, e.g. a Tabler icon |
| `onClick`   | `() => void`                 | Required                         |
| `label`     | `string`                     | Required — used as `aria-label`  |
| `tone`      | `'default' \| 'destructive'` | Default `default`                |
| `disabled`  | `boolean`                    |                                  |
| `className` | `string`                     | Optional root class              |

## Usage

```tsx
import { DesignSystemV2Provider, RowActionIcon } from '@app/components/v2';
import { IconTrash } from '@tabler/icons-react';

<DesignSystemV2Provider>
  <RowActionIcon
    icon={<IconTrash size={16} />}
    onClick={handleDelete}
    label="Delete"
    tone="destructive"
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Calls `event.stopPropagation()` internally before `onClick` — consumers do not need to remember this themselves when nesting inside a clickable row.
- Live demos: `/styleguide/v2/data-display`

## Related

- [DataTable.md](./DataTable.md)
- [MembershipRow.md](./MembershipRow.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
