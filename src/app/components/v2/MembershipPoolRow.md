# MembershipPoolRow

Pool ("B" role) add-candidate row for `AddMembersScreen`.

## Purpose

A sparse candidate row for the full-screen add takeover — checkbox + identity + light secondary info, no edit/delete/reorder. Supports the **blocked-but-visible** pattern (e.g. "this zone", "already nested", "would create a cycle").

## Props

| Prop        | Type         | Notes                                                               |
| ----------- | ------------ | ------------------------------------------------------------------- |
| `checked`   | `boolean`    |                                                                     |
| `onCheck`   | `() => void` |                                                                     |
| `disabled`  | `boolean`    | Blocked-but-visible: greyed row, disabled checkbox, visible reason  |
| `label`     | `ReactNode`  | Required                                                            |
| `subtitle`  | `ReactNode`  |                                                                     |
| `pills`     | `ReactNode`  | Hidden when `disabled`                                              |
| `reason`    | `ReactNode`  | Blocked-reason text shown when `disabled`; falls back to `subtitle` |
| `className` | `string`     | Optional root class                                                 |

## Usage

```tsx
import { DesignSystemV2Provider, MembershipPoolRow } from '@app/components/v2';

<DesignSystemV2Provider>
  <MembershipPoolRow label="Zone B" checked={staged.has('b')} onCheck={() => toggle('b')} />
  <MembershipPoolRow label="Zone A" disabled reason="This zone" />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- **Blocked-candidate enforcement lives on this row, not on the consumer**: when `disabled`, the checkbox is a native `disabled` input **and** `onCheck` is never wired to it, so a blocked key can never enter a consumer's staged-selection state. `AddMembersScreen` does not separately filter blocked keys because this row already guarantees it.
- Live demos: `/styleguide/v2/membership`

## Related

- [AddMembersScreen.md](./AddMembersScreen.md)
- [MembershipPanel.md](./MembershipPanel.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
