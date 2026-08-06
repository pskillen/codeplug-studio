# MembershipRow

Member ("C" role) row for the Membership family.

## Purpose

The in-list member row for `MembershipPanel` — supersedes `ShuttleRow`'s naming and shape for the mk2 members-first list + full-screen add takeover pattern (see [ShuttleList.md](./ShuttleList.md) for what it replaces). Designed as a self-contained card-style row rather than a render prop into an existing list shell.

## Props

| Prop              | Type                                  | Notes                                                                                |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `label`           | `ReactNode`                           | Required                                                                             |
| `subtitle`        | `ReactNode`                           |                                                                                      |
| `pills`           | `ReactNode`                           | Inline next to the label                                                             |
| `dragHandle`      | `boolean`                             | Reserve the leading drag-handle slot. Default `true`                                 |
| `dragHandleProps` | `SelectedItemDragHandleProps \| null` | Live dnd-kit wiring from `SelectedItemList`'s `renderItem`; static icon when omitted |
| `checked`         | `boolean`                             |                                                                                      |
| `onCheck`         | `() => void`                          | Presence shows the row checkbox                                                      |
| `trailing`        | `ReactNode`                           | Edge-property slot — e.g. `includeInScanList` / `timeSlotOverride`                   |
| `onRemove`        | `() => void`                          | Presence shows the trailing remove action                                            |
| `className`       | `string`                              | Optional root class                                                                  |

## Usage

```tsx
import { DesignSystemV2Provider, MembershipRow } from '@app/components/v2';

<DesignSystemV2Provider>
  <MembershipRow
    label="GB3DA Stornoway"
    subtitle="145.575 MHz"
    onCheck={() => toggle(id)}
    checked={selected}
    onRemove={() => remove(id)}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Checkbox and remove action are both **implicit by prop presence** — omit `onCheck`/`onRemove` to hide them, rather than a separate boolean flag. This is how the reorder-only, no-selection variant (build's zone member order) composes without a `mode` prop.
- `dragHandleProps` is externally supplied, not self-managed — `MembershipRow` renders whatever `setActivatorNodeRef`/`attributes`/`listeners` it's given (or a static, non-interactive icon when omitted) but never calls `useSortable` itself. The consumer's list shell owns the `DndContext`/`useSortable` wiring, same pattern as `ShuttleRow`. The styleguide demo (`StyleguideV2MembershipPage.tsx`) shows the reference wiring via `DataTableBulkReorderProvider`/`Sortable`; real editor call sites (#941–#943) will need the same.
- Live demos: `/styleguide/v2/membership`

## Related

- [MembershipPanel.md](./MembershipPanel.md)
- [RowActionIcon.md](./RowActionIcon.md)
- [ShuttleList.md](./ShuttleList.md) — the pattern this supersedes
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
