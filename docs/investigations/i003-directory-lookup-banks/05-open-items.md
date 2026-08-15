# Open items

i003 is **live**. Preliminary mapping only.

## Hardware (blocks encode SoT)

| Id | Item |
| --- | --- |
| I003-H1 | Confirm 1701 User Database FLASH vs qdmr `0x50000` / `0xd8000` and FirmwareInfo extended-DB bit |
| I003-H2 | Confirm 1701 max entries vs user-guide 13.8k–69.6k and CPS character-length setting |
| I003-H3 | After Write with RadioID **off**, does 1701 Backup inspect still show ~1024 directory-like names? (leftover vs live merge) |
| I003-H4 | DM-32: does incoming-call display read V-frame `0x0F` (not `0x67`)? |
| I003-H5 | DM-32: can serial hold 50k/150k directory rows in `0x0F`, with CPS 250 UI-only? |
| I003-H6 | Should Backup/Restore grow to include 1701 User Database / DM-32 `0x0F`? (size; optional after Write works) |
| I003-H7 | D890: confirm LCD incoming-call lookup reads `DigitalContact*` (A6 inference) |

## Code stop-gap (no new protocol)

| Id | Item | Ticket |
| --- | --- | --- |
| I003-C1 | Stop merging directory into OpenGD77 `digitalContacts` / `Contacts.csv`; RadioID/Both warn or no-op until User Database Write | #1211 |
| I003-C2 | Stop merging directory into DM-32 `0x67` / `DMR-ID.csv`; keep `0x67` as channel `dmrId` only | #1220 |
| I003-C3 | Copy: Write modal + contact-directories hub must not imply OpenGD77 has a DM-32-style second *contact* bank | both |
| I003-C4 | Dual-bank: **stop** skipping directory rows that match a library `digitalId`. Single-bank (D890): **keep** that skip. Split or gate `shouldIncludeDirectoryRow`. | #1211, #1220 |

## Later encode

| Id | Item | Ticket |
| --- | --- | --- |
| I003-E1 | 1701/MD-9600 User Database encode + Write contacts only → that region; extra FLASH spans, do not stretch `IMAGE_END` | #1211 |
| I003-E2 | If H4 holds: DM-32 directory → `0x0F` after library, firmware cap not CPS 250; **do not** skip overlapping library `digitalId`s (P2 / C4) | #1220 |
