# EntityDeleteButton

## Purpose

Destructive delete control for library entity editors. Runs [`runEntityDeleteFlow`](../../lib/entityDeleteFlow.ts) with referential-integrity blocking and inline error display.

## Props

| Prop             | Type                   | Description                                    |
| ---------------- | ---------------------- | ---------------------------------------------- |
| `kind`           | `LibraryEntityKind`    | Entity type (`talkGroup`, `zone`, …)           |
| `entityId`       | `string`               | Target entity UUID                             |
| `label`          | `string`               | Display name for confirm dialog                |
| `onDeleted`      | `() => void`           | Called after successful delete (e.g. navigate) |
| `confirmMessage` | `string`               | Optional override for `window.confirm` copy    |
| `size`           | Mantine button size    | Default `compact-sm`                           |
| `variant`        | Mantine button variant | Default `light`                                |

## Usage

```tsx
import EntityDeleteButton from '@app/components/library/EntityDeleteButton.tsx';

<EntityDeleteButton
  kind="talkGroup"
  entityId={entity.id}
  label={entity.name}
  onDeleted={() => navigate('/library/talk-groups')}
/>;
```

## Behaviour

- Shows a browser confirm before delete.
- On blocked delete, renders a red `Alert` listing referencing entities.
- Channel delete uses [`ChannelDeleteButton`](./ChannelDeleteButton.tsx) for zone-membership cascade.

## Related

- [Library CRUD](../../../docs/features/library/README.md)
