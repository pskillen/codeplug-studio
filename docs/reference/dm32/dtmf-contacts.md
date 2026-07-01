# DM32 — DTMFContacts.csv

Analog signalling contacts (`signalingMode: 'dtmf'`).

| Column            | Internal             | Notes                |
| ----------------- | -------------------- | -------------------- |
| `No.`             | _(export only)_      | Sequential on export |
| `Analog Contacts` | `Contact.name`       |                      |
| `ID`              | `Contact.identifier` | DTMF code string     |

Split from `Contacts.csv` on export by `signalingMode`.
