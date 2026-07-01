# DM32 — Talkgroups.csv

| Column | Internal             | Notes                                                                                                                                                       |
| ------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No.`  | _(export only)_      | Sequential on export                                                                                                                                        |
| `Name` | `TalkGroup.name`     | FK target for digital TX / RX list members; export shortens when over profile `nameLimit` (16) — `TalkGroup.abbreviation` first, then dictionary shortening |
| `ID`   | `TalkGroup.number`   | DMR talk-group ID string                                                                                                                                    |
| `Type` | `TalkGroup.callType` | `Group Call` → `group`; `Private Call` → `private`                                                                                                          |

Private-call rows in this file (e.g. `Parrot 9990`) bidirectional mapping here — they are not moved to `Contacts.csv`.
