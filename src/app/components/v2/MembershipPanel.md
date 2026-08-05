# MembershipPanel

Member-panel shell for the Membership family: title + Add, find-in-list filter, permanent Sort… affordance, bulk toolbar.

## Purpose

Header/toolbar chrome around a list of `MembershipRow`s. Exported as both `MembershipPanel` (design-system name) and `MembershipList` (alias), mirroring `ShuttleListPanel`/`ShuttleList`.

## Props

| Prop               | Type                                | Notes                                                                                                                           |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `title`            | `ReactNode`                         | Required                                                                                                                        |
| `description`      | `ReactNode`                         |                                                                                                                                 |
| `addLabel`         | `string`                            | Default `Add`                                                                                                                   |
| `onAdd`            | `() => void`                        | Presence shows the "+ Add" button. **Omit for the reorder-only, no-pool variant.**                                              |
| `search`           | `{ value, onChange, placeholder? }` | Find-in-list filter                                                                                                             |
| `sortLabel`        | `string`                            | Default `Sort…`                                                                                                                 |
| `onSortClick`      | `() => void`                        | Presence shows the permanent Sort… affordance; replaced by "Reorder disabled while filtering" while `search.value` is non-empty |
| `selectedCount`    | `number`                            | Default `0`                                                                                                                     |
| `onBulkMoveUp`     | `() => void`                        | Bulk toolbar action                                                                                                             |
| `onBulkMoveDown`   | `() => void`                        | Bulk toolbar action                                                                                                             |
| `onBulkRemove`     | `() => void`                        | Bulk toolbar action                                                                                                             |
| `onClearSelection` | `() => void`                        | Bulk toolbar action                                                                                                             |
| `isEmpty`          | `boolean`                           | Shows `emptyMessage` instead of `children`                                                                                      |
| `emptyMessage`     | `ReactNode`                         | Default `No members yet.`                                                                                                       |
| `children`         | `ReactNode`                         | The `MembershipRow` list                                                                                                        |

## Usage

```tsx
import { DesignSystemV2Provider, MembershipPanel, MembershipRow } from '@app/components/v2';

<DesignSystemV2Provider>
  <MembershipPanel
    title="Zone members"
    description="3 direct · 12 channels effective"
    onAdd={openAddScreen}
  >
    <MembershipRow label="GB3DA Stornoway" onRemove={() => removeMember('1')} />
  </MembershipPanel>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- **Implicit-by-prop-presence composition**, not a `mode` enum: omitting `onAdd` yields the reorder-only, no-pool variant (the build's zone member order screen); the bulk toolbar only appears once `selectedCount > 0` **and** at least one bulk handler is provided.
- The Sort… affordance is a **permanent, confirm-gated rewrite of the true order** — distinct from any temporary browse sort, and disabled while the find-in-list filter is active (to avoid reordering a filtered subset).
- Live demos: `/styleguide/v2/membership`

## Related

- [MembershipRow.md](./MembershipRow.md)
- [MembershipPoolRow.md](./MembershipPoolRow.md)
- [AddMembersScreen.md](./AddMembersScreen.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
