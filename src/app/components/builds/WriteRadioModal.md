# WriteRadioModal

## Purpose

Build → Export **Write radio** popup: always **Write codeplug**, plus radio-appropriate extras for digital contacts and satellite keps.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `open` | `boolean` | Modal visibility |
| `onClose` | `() => void` | Dismiss |
| `buildId` | `string` | For Satellite keps tab link |
| `serialOk` | `boolean` | Web Serial / USB-serial available |
| `busy` | `boolean` | Transfer in progress |
| `writeHidden` | `boolean` | Prod write gate |
| `supportsDigitalContacts` | `boolean` | Dual-bank trait or D890 single-bank |
| `sharedContactBankNote` | `boolean` | OpenGD77 shared Contacts bank caveat |
| `supportsKeps` | `boolean` | Registered keps write adapter |
| `contactSource` | `DigitalContactsWriteSource` | `none` \| `library` \| `directory` \| `both` |
| `onContactSourceChange` | `(source) => void` | Source picker |
| `kepsSelected` | `boolean` | Keps extra |
| `onKepsSelectedChange` | `(selected) => void` | Keps checkbox |
| `onWriteCodeplug` | `() => void` | Full codeplug write |
| `onWriteContacts` | `() => void` | Contacts-bank-only write |
| `onWriteKeps` | `() => void` | Keps-only write |

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
- **Write this** for digital contacts is disabled while source is None. **Write this** for keps is disabled while the checkbox is off.
- Write codeplug never writes keps. Copy uses digital contacts / library contacts / RadioID directory — not “digital ID list”.
- Empty RadioID shadow warning is owned by `BuildRadioIoPanel`, not this modal.

## Related

- [BuildRadioIoPanel.md](./BuildRadioIoPanel.md)
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [contact-directories](../../../docs/features/contact-directories/README.md)
- [satellite-keps](../../../docs/features/satellite-keps/README.md)
