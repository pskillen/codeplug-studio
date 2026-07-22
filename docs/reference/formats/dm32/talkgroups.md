# DM32 — Talkgroups.csv

| Column | Internal              | Notes                                                                                                                                                       |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `No.`  | _(export only)_       | Sequential on export                                                                                                                                        |
| `Name` | `TalkGroup.name`      | FK target for digital TX / RX list members; export shortens when over profile `nameLimit` (16) — `TalkGroup.abbreviation` first, then dictionary shortening |
| `ID`   | `TalkGroup.digitalId` | DMR talk-group ID string                                                                                                                                    |
| `Type` | —                     | **Constant** `Group Call` on Studio export today — not projected from a library call-type field                                                             |

Private-call DMR IDs belong in `Contacts.csv` (`DigitalContact`), not here. Studio does not emit `Private Call` rows into `Talkgroups.csv` on export.
