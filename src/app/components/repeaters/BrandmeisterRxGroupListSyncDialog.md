# BrandmeisterRxGroupListSyncDialog

## Purpose

Modal opened from channel edit when the operator chooses **Check BrandMeister talk groups & RX list** on `RepeaterVerifyPanel`. Compares the channel's linked RX group list against BrandMeister static talk groups and lets the operator update the existing list or create a new one.

## Props

| Prop         | Type              | Description                                     |
| ------------ | ----------------- | ----------------------------------------------- |
| `channel`    | `Channel`         | Channel being verified                          |
| `library`    | `Library`         | Current project library (for TG/RGL resolution) |
| `listing`    | `RepeaterListing` | Matched BrandMeister device listing             |
| `opened`     | `boolean`         | Modal visibility                                |
| `onClose`    | `() => void`      | Close handler                                   |
| `onApplied?` | `() => void`      | Called after successful apply                   |

## Usage

```tsx
<BrandmeisterRxGroupListSyncDialog
  channel={channel}
  library={library}
  listing={listing}
  opened={rglSyncOpen}
  onClose={() => setRglSyncOpen(false)}
/>
```

## Behaviour

- Fetches `GET /device/{id}/talkgroup` when opened.
- Disables **Update existing** when other channels reference the same RX group list (`findReferencesTo`).
- **Create new** repoints only this channel's DMR `rxGroupListId`.
- Optional **Create missing talk groups** (default on) before building list members.
- When the linked list already matches BrandMeister, shows a yellow **warning** alert and hides apply controls (checkbox, update/create radios, new list name).

## Related

- [`RepeaterVerifyPanel.tsx`](RepeaterVerifyPanel.tsx)
- [`docs/features/repeater-directories/README.md`](../../../docs/features/repeater-directories/README.md)
