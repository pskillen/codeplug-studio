# ExportOrderOverrideBanner

## Purpose

Shows a clear list- or section-level signal that **build export order** differs from the library default, with a **Reset to library order** control. Used on Radio Builds wire-preview surfaces (zones list, flat memory, zone member order).

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `visible` | `boolean` | When false, renders nothing |
| `disabled` | `boolean?` | Disables the reset button (e.g. while saving) |
| `onReset` | `() => void` | Caller must confirm (`window.confirm`) then clear overrides |
| `message` | `string?` | Optional body copy override |

## Behaviour

- Yellow `Alert` titled “Build order overridden” — stronger than caption-only copy.
- Does **not** run confirm itself; mirrors Sort… seriousness at the call site via core confirm helpers (`exportOrderResetConfirmMessage` / `zoneMemberOrderResetConfirmMessage`).
- Distinct from DataTable `storedOrder` “Return to export order” (display-only browse restore).

## Related

- [`exportOrderOrSlot.ts`](../../../../core/domain/exportOrderOrSlot.ts) — `hasAnyOrderOrSlotOverride`, `clearAllOrderOrSlots`
- [`zoneGroupingLayout.ts`](../../../../core/domain/zoneGroupingLayout.ts) — member-order detect/reset
- [lists-and-ordering](../../../../../docs/reference/styleguide/lists-and-ordering.md)
