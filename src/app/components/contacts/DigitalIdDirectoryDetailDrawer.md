# DigitalIdDirectoryDetailDrawer

Detail modal for one **ID directory** entry, with **Add to contacts**.

## Purpose

Shows a lookup-only directory row (RadioID.net download) and lets the operator promote it to a library contact. The action buttons sit in the `ModalShell` footer so they stay visible without scrolling the body.

## Props

| Prop              | Type                              | Notes                                                            |
| ----------------- | --------------------------------- | ---------------------------------------------------------------- |
| `entry`           | `DigitalIdDirectoryEntry \| null` | Row to show; `null` renders nothing                              |
| `libraryContacts` | `DigitalContact[]`                | Used to detect an existing contact with the same `digitalId`     |
| `opened`          | `boolean`                         |                                                                  |
| `onClose`         | `() => void`                      |                                                                  |
| `onCopied`        | `(contactId: string) => void`     | Optional — called after a contact is saved (e.g. reload library) |

## Usage

```tsx
<DigitalIdDirectoryDetailDrawer
  entry={detailEntry}
  libraryContacts={library.digitalContacts}
  opened={detailOpen}
  onClose={() => setDetailOpen(false)}
  onCopied={() => void reload()}
/>
```

## Behaviour

- Footer: **Close**, **Fetch from RadioID.net**, then **Add to contacts**, or **Open contact** when the `digitalId` is already a contact.
- Add uses `addDirectoryEntryToContacts` (shared with the table row action). On success the modal stays open, shows "Added to contacts." and switches the primary button to **Open contact** once `libraryContacts` reloads.
- Fields render in a two-column grid; name, remarks and fetched time span both columns.

## Related

- [contact-directories](../../../../docs/features/contact-directories/README.md) — workflows and terminology
- [ModalShell.md](../v2/ModalShell.md)
