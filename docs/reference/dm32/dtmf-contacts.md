# DM32 — DTMFContacts.csv

Analog signalling contacts (`AnalogContact`).

| Column            | Internal             | Notes                |
| ----------------- | -------------------- | -------------------- |
| `No.`             | _(export only)_      | Sequential on export |
| `Analog Contacts` | `AnalogContact.name` |                      |
| `ID`              | `AnalogContact.code` | DTMF code string     |

Split from `Contacts.csv` on export by contact kind (`digitalContacts` vs `analogContacts` in assemble).
