# WriteRadioModal

## Purpose

Build → Export **Write radio** popup: always **Write codeplug**, plus radio-appropriate extras for digital contacts and satellite keps.

## Props

| Prop                      | Type                         | Description                                  |
| ------------------------- | ---------------------------- | -------------------------------------------- |
| `open`                    | `boolean`                    | Modal visibility                             |
| `onClose`                 | `() => void`                 | Dismiss                                      |
| `buildId`                 | `string`                     | For Satellite keps tab link                  |
| `serialOk`                | `boolean`                    | Web Serial / USB-serial available            |
| `busy`                    | `boolean`                    | Transfer in progress                         |
| `writeHidden`             | `boolean`                    | Prod write gate                              |
| `supportsDigitalContacts` | `boolean`                    | Dual-bank trait or D890 single-bank          |
| `sharedContactBankNote`   | `boolean`                    | OpenGD77 shared Contacts bank caveat         |
| `sharedAddressBookNote`   | `boolean`                    | DM-32: library and RadioID share one book    |
| `supportsKeps`            | `boolean`                    | Registered keps write adapter                |
| `kepsLastUpdatedIso`      | `string \| null`             | `ProjectMeta.satelliteLibraryLastUpdated`    |
| `contactSource`           | `DigitalContactsWriteSource` | `none` \| `library` \| `directory` \| `both` |
| `onContactSourceChange`   | `(source) => void`           | Source picker                                |
| `kepsSelected`            | `boolean`                    | Keps extra                                   |
| `onKepsSelectedChange`    | `(selected) => void`         | Keps checkbox                                |
| `onWriteCodeplug`         | `() => void`                 | Full codeplug write                          |
| `onWriteContacts`         | `() => void`                 | Contacts-bank-only write                     |
| `onWriteKeps`             | `() => void`                 | Keps-only write                              |

## Usage

```tsx
<WriteRadioModal
  open={open}
  onClose={() => setOpen(false)}
  buildId={build.id}
  serialOk
  busy={false}
  writeHidden={false}
  supportsDigitalContacts
  supportsKeps
  contactSource="none"
  onContactSourceChange={setSource}
  kepsSelected={false}
  onKepsSelectedChange={setKeps}
  onWriteCodeplug={writeCodeplug}
  onWriteContacts={writeContacts}
  onWriteKeps={writeKeps}
/>
```

## Behaviour

- Parent resets extras to **none** / keps unchecked every time the popup opens (do not persist last session).
- **Write contacts only** is disabled while source is None. **Write keps only** is disabled while the checkbox is off.
- Write codeplug helper copy only mentions digital contacts or keps when those extras are on this radio.
- Copy uses digital contacts / library contacts / RadioID directory — not “digital ID list”.
- OpenGD77 (`sharedContactBankNote`): RadioID writes User Database; library/Both replace the 1024 contact bank; overlapping `digitalId`s are kept in both stores.
- DM-32 (`sharedAddressBookNote`): library and RadioID share one address book; RadioID/Both **replace** it; None leaves it; operator radio IDs stay channel DMR IDs on Write codeplug; duplicate IDs: library wins.
- Empty RadioID shadow warning is owned by `BuildRadioIoPanel`, not this modal.
- When `supportsKeps`, shows keps last-updated (`KepsLastUpdated`) with a link to Library → Satellite Keps; preview tab link unchanged.

## Related

- [KepsLastUpdated.md](../library/KepsLastUpdated.md)

- [BuildRadioIoPanel.md](./BuildRadioIoPanel.md)
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [contact-directories](../../../docs/features/contact-directories/README.md)
- [satellite-keps](../../../docs/features/satellite-keps/README.md)
