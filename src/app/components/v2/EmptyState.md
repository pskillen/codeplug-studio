# EmptyState (v2)

Icon badge + title + description + optional action.

## Purpose

The design-system-v2 empty state for lists, pools, and pages. A **new, independent** component — v1 `ui/EmptyState.tsx` (message-only, no title/description split) is untouched and stays in use where it already renders (e.g. inside `components/ui/DataTable`) until a later migration.

## Props

| Prop          | Type        | Notes                                                              |
| ------------- | ----------- | ------------------------------------------------------------------ |
| `icon`        | `ReactNode` | Default `IconInbox`                                                |
| `title`       | `ReactNode` | Required                                                           |
| `description` | `ReactNode` | Max-width 320px                                                    |
| `action`      | `ReactNode` |                                                                    |
| `compact`     | `boolean`   | Reduces padding (48px → 28px) for denser contexts. Default `false` |
| `className`   | `string`    | Optional root class                                                |

## Usage

```tsx
import { DesignSystemV2Provider, EmptyState } from '@app/components/v2';

<DesignSystemV2Provider>
  <EmptyState
    title="No channels yet"
    description="Add channels from a directory or a CPS import."
    action={<Button onClick={openAddFrom}>Add from…</Button>}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Centered column: circular icon badge (40×40, bordered) → title → description → optional action.
- Live demos: `/styleguide/data-display`

## Related

- [DataTable.md](./DataTable.md)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
