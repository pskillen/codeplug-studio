# AddMembersScreen

Full-screen picker takeover — the pool ("B") side of the Membership family.

## Purpose

The mechanism behind sectioned candidate pools: a `MembershipPanel`'s `onAdd` opens this screen; the operator stages candidates via `MembershipPoolRow`s, then commits back into the member list. Sections cover Zones' 2-section pool (Channels + Zones), RGL's 2-section pool (Talk groups + Digital contacts), and Scan's single-section pool.

## Props

| Prop              | Type                                | Notes                                                   |
| ----------------- | ----------------------------------- | ------------------------------------------------------- |
| `open`            | `boolean`                           | Required                                                |
| `title`           | `ReactNode`                         | Required                                                |
| `onCancel`        | `() => void`                        | Required                                                |
| `sections`        | `{ id, label, count? }[]`           | Tabs render only when there's more than one section     |
| `activeSectionId` | `string`                            |                                                         |
| `onSectionChange` | `(id: string) => void`              |                                                         |
| `search`          | `{ value, onChange, placeholder? }` | Pool text filter                                        |
| `totalStaged`     | `number`                            | Required — drives the disabled "Add selected (N)" state |
| `onCommit`        | `() => void`                        | Required                                                |
| `children`        | `ReactNode`                         | `MembershipPoolRow`s for the active section             |

## Usage

```tsx
import { AddMembersScreen, DesignSystemV2Provider, MembershipPoolRow } from '@app/components/v2';

<DesignSystemV2Provider>
  <AddMembersScreen
    open={open}
    title="Add channels"
    onCancel={() => setOpen(false)}
    totalStaged={staged.size}
    onCommit={handleCommit}
  >
    <MembershipPoolRow label="GB3DA" onCheck={() => toggle('1')} checked={staged.has('1')} />
  </AddMembersScreen>
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`. Renders `null` when `open` is false.
- Full-viewport fixed overlay (`position: fixed; inset: 0`), not a centered dialog — distinct from the `ModalShell` family.
- "Add selected (N)" is disabled at `totalStaged === 0`.
- Blocked candidates never contribute to `totalStaged` because `MembershipPoolRow` never wires `onCheck` when `disabled` — this screen does not need its own gating logic.
- Live demos: `/styleguide/v2/membership`

## Related

- [MembershipPoolRow.md](./MembershipPoolRow.md)
- [MembershipPanel.md](./MembershipPanel.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
