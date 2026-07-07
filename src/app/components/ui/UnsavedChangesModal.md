# UnsavedChangesModal

## Purpose

Confirm dialog when the operator tries to leave a form with unsaved edits. Paired with [`useUnsavedNavigationGuard`](../../hooks/useUnsavedNavigationGuard.ts) and [`useEntityFormDirty`](../../hooks/useEntityFormDirty.ts).

## Props

| Prop      | Type         | Description                                     |
| --------- | ------------ | ----------------------------------------------- |
| `opened`  | `boolean`    | Modal visibility (from guard `modalOpen`)       |
| `onStay`  | `() => void` | Stay on the page — calls guard `stay`           |
| `onLeave` | `() => void` | Discard and navigate — calls guard `leave`      |
| `title`   | `string`     | Modal title (default: "Unsaved changes")        |
| `message` | `string`     | Body copy (default: generic leave-without-save) |

## Usage

```tsx
import UnsavedChangesModal from '@app/components/ui/UnsavedChangesModal.tsx';
import { useEntityFormDirty } from '@app/hooks/useEntityFormDirty.ts';
import { useUnsavedNavigationGuard } from '@app/hooks/useUnsavedNavigationGuard.ts';

const { isDirty, permitNavigationRef, permitNavigationOnce } = useEntityFormDirty({
  baseline,
  buildCurrent: buildRow,
});
const { modalOpen, stay, leave } = useUnsavedNavigationGuard(isDirty, permitNavigationRef);

<UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />;
```

## Behaviour

- **Stay** resets the React Router blocker so navigation is cancelled.
- **Leave** calls `blocker.proceed()` so the pending navigation completes.
- Tab close uses the browser `beforeunload` prompt from the guard hook (not this modal).

## Related

- [Library CRUD](../../../docs/features/library/README.md) — entity editors using this pattern
- [Build wire preview](../../../docs/features/builds/wire-preview.md) — first consumer
