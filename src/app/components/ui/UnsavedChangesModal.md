# UnsavedChangesModal

## Purpose

C2 unsaved-changes confirm when the operator tries to leave a form with unsaved edits. Thin adapter over v2 [`ConfirmModal`](../v2/ConfirmModal.md) with **default** (non-destructive) tone — Discard is primary, not a red destructive action. Paired with [`useUnsavedNavigationGuard`](../../hooks/useUnsavedNavigationGuard.ts) and [`useEntityFormDirty`](../../hooks/useEntityFormDirty.ts).

## Props

| Prop      | Type         | Description                                       |
| --------- | ------------ | ------------------------------------------------- |
| `opened`  | `boolean`    | Modal visibility (from guard `modalOpen`)         |
| `onStay`  | `() => void` | Stay on the page — calls guard `stay`             |
| `onLeave` | `() => void` | Discard and navigate — calls guard `leave`        |
| `title`   | `string`     | Modal title (default: "Discard unsaved changes?") |
| `message` | `string`     | Body copy (default: generic discard-and-leave)    |

## Usage

```tsx
import UnsavedChangesModal from '@app/components/ui/UnsavedChangesModal.tsx';
import { useEntityFormDirty } from '@app/hooks/useEntityFormDirty.ts';
import { useUnsavedNavigationGuard } from '@app/hooks/useUnsavedNavigationGuard.ts';

const { isDirty, permitNavigationRef } = useEntityFormDirty({
  baseline,
  buildCurrent: buildRow,
});
const { modalOpen, stay, leave } = useUnsavedNavigationGuard(isDirty, permitNavigationRef);

<UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />;
```

## Behaviour

- Renders inside a nested `DesignSystemV2Provider` so ds tokens apply even when the parent route is outside shell chrome scope.
- **Stay** resets the React Router blocker so navigation is cancelled.
- **Discard** calls `blocker.proceed()` so the pending navigation completes.
- Tab close uses the browser `beforeunload` prompt from the guard hook (not this modal).

## Related

- [Library CRUD](../../../docs/features/library/README.md) — entity editors using this pattern
- [Design system v2 overlays](../../../docs/features/design-system-v2/README.md) — `ConfirmModal` primitive
