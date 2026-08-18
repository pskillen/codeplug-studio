# Open items

i003 is **live**. OpenGD77 1701 User Database **Write ACK’d**; LCD lookup still open. Silent-repeater LCD miss on MD-9600 is **not** yet an encode failure. DM-32 directory → `0x0F` is in code ([#1220](https://github.com/pskillen/codeplug-studio/issues/1220)); LCD unproven. Split-bank Write UI: [#1249](https://github.com/pskillen/codeplug-studio/issues/1249).

## Hardware (blocks SoT / LCD proof)

| Id      | Item                                                                                                                                                                                                                                                                                                                                    |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I003-H1 | Confirm 1701 User Database FLASH **contents** vs qdmr `0x50000` / `0xd8000` (dump or Backup inspect magic `Id`) and FirmwareInfo extended-DB bit. Write to that sector **ACK’d** (`R/2026-08-15-1701-udb-ack`) — not a dump.                                                                                                            |
| I003-H2 | Confirm 1701 max entries vs user-guide 13.8k–69.6k and CPS character-length setting                                                                                                                                                                                                                                                     |
| I003-H3 | After Write with RadioID **off**, does 1701 Backup inspect still show leftover directory-like names in the **contact bank** from older stuffing?                                                                                                                                                                                        |
| I003-H4 | DM-32: does incoming-call display read V-frame `0x0F` (not `0x67`)?                                                                                                                                                                                                                                                                     |
| I003-H5 | DM-32: can serial hold 50k/150k directory rows in `0x0F`, with CPS 250 UI-only? Studio write ceiling remains `ADDRESS_BOOK_WRITE_MAX` (11 264).                                                                                                                                                                                         |
| I003-H6 | DM-32: should Backup/Restore include `0x0F`? OpenGD77 occupied User Database inspect shipped (not restore, not full `size1`). Clone Read still skips `0x0F`; Write allocates.                                                                                                                                                           |
| I003-H7 | D890: confirm LCD incoming-call lookup reads `DigitalContact*` (A6 inference)                                                                                                                                                                                                                                                           |
| I003-H8 | Incoming / group-call display shows directory callsign after User Database Write. Silent repeater now **tried** on MD-9600 (`O/2026-08-18-lcd-silent`) — names still absent. **Not LCD-proof** until UDB programming is confirmed on that radio (H9 + not Digital contacts None). Next: [E1](errands/01-md9600-udb-then-silent-lcd.md). |
| I003-H9 | MD-9600: User Database Write still unproven (no ACK row, not in write-verify staging). Same map as 1701 in code (G8). Do this **before** treating H8 as an encode miss. Protocol: [E1](errands/01-md9600-udb-then-silent-lcd.md).                                                                                                       |

## Code stop-gap (no new protocol)

None open. **I003-C2** shipped (#1220): directory is not merged into `0x67` / `DMR-ID.csv`. **I003-C4** resolved as skip-on-Both for shared `0x0F` (P2); OpenGD77 keep-overlap unchanged.

## Later encode

**I003-E2** shipped with **block cap** (`ADDRESS_BOOK_WRITE_MAX`), not firmware 50k/150k. Overlap skip on Both (shared bank). H5 remains if we ever raise `CONTACT_BANK_MAX_BLOCKS`.
