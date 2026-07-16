# DeleteAllDigitalContactsDialog

## Purpose

Double-confirm modal for wiping every digital contact in the active project — recovery after a huge RadioID (or other) import when the contacts list is under memory pressure.

## Props

| Prop           | Type                                                      | Description                                      |
| -------------- | --------------------------------------------------------- | ------------------------------------------------ |
| `opened`       | `boolean`                                                 | Modal visibility                                 |
| `onClose`      | `() => void`                                              | Dismiss handler (ignored while delete is running) |
| `contactCount` | `number`                                                  | Approximate count shown in the warning copy      |
| `onConfirm`    | `() => Promise<DeleteAllDigitalContactsResult>`           | Cascade wipe (channels / RX lists / builds + IDB clear) |

## Behaviour

1. Operator opens via **Delete all** on Library → Contacts (digital section).
2. Modal explains irreversible wipe + cascade of channel/`RX` refs.
3. **Delete all** stays disabled until the confirmation checkbox is ticked.
4. Cancel / dismiss leaves data unchanged; busy state while wipe runs.

## Related

- [`libraryService.deleteAllDigitalContacts`](../../state/libraryService.ts)
- [library contacts](../../../../docs/features/library/README.md)
- [contact-directories](../../../../docs/features/contact-directories/README.md)
