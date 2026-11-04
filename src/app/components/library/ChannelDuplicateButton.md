# ChannelDuplicateButton

## Purpose

The **Duplicate** button for a channel, with a confirm step. On confirm it creates a copy with `duplicateChannel` (`@core/domain/factories.ts`), saves it, and opens the copy in the editor (`/library/channels/:id/edit`). Used on the channel view page and in the channel editor.

## Props

| Prop                   | Type            | Description                                                                                      |
| ---------------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `projectId`            | `string`        | Project the copy belongs to                                                                      |
| `getSource`            | `() => Channel` | The channel to copy, read when the dialog opens and on confirm (the editor passes its live form) |
| `includesUnsavedEdits` | `boolean`       | Editor only: the form is dirty; the dialog says those edits go into the copy, not the original   |
| `variant`              | `ButtonVariant` | v2 button variant (default `outline`; the editor uses `ghost`)                                   |

## Usage

```tsx
<ChannelDuplicateButton projectId={projectId} getSource={() => channel} />

<ChannelDuplicateButton
  projectId={projectId}
  getSource={buildRow}
  includesUnsavedEdits={isDirty}
  variant="ghost"
/>
```

## Behaviour

- Clicking opens a `ConfirmModal`: "Duplicate channel?", naming the source as callsign · name and the copy's name (`<name> (copy)`), and noting that zone memberships are not copied.
- **Cancel** writes nothing. **Duplicate** saves the copy, shows "Working…" while it saves, then navigates to the copy's editor; a failed save keeps the dialog open with an error.

## Related

- [Library hub — Channel view and Channel editor](../../../../docs/features/library/README.md)
- [`ChannelDeleteButton.tsx`](./ChannelDeleteButton.tsx), the neighbouring action
