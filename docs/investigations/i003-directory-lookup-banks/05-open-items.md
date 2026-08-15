# Open items

i003 is **live**. OpenGD77 1701 User Database **Write ACK’d**; LCD lookup still open. DM-32 still stop-gap.

## Hardware (blocks SoT / LCD proof)

| Id      | Item                                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I003-H1 | Confirm 1701 User Database FLASH **contents** vs qdmr `0x50000` / `0xd8000` (dump or Backup inspect magic `Id`) and FirmwareInfo extended-DB bit. Write to that sector **ACK’d** (`R/2026-08-15-1701-udb-ack`) — not a dump. |
| I003-H2 | Confirm 1701 max entries vs user-guide 13.8k–69.6k and CPS character-length setting                                                                                                                                          |
| I003-H3 | After Write with RadioID **off**, does 1701 Backup inspect still show leftover directory-like names in the **contact bank** from older stuffing?                                                                             |
| I003-H4 | DM-32: does incoming-call display read V-frame `0x0F` (not `0x67`)?                                                                                                                                                          |
| I003-H5 | DM-32: can serial hold 50k/150k directory rows in `0x0F`, with CPS 250 UI-only?                                                                                                                                              |
| I003-H6 | DM-32: should Backup/Restore include `0x0F`? OpenGD77 occupied User Database inspect shipped (not restore, not full `size1`).                                                                                                |
| I003-H7 | D890: confirm LCD incoming-call lookup reads `DigitalContact*` (A6 inference)                                                                                                                                                |
| I003-H8 | Incoming / group-call display shows directory callsign after User Database Write. Needs a path **without Talker Alias** (repeater or private).                                                                               |
| I003-H9 | MD-9600: same map smoke if hardware is available; else 1701-only on #1211                                                                                                                                                    |

## Code stop-gap (no new protocol)

| Id      | Item                                                                                                                                                       | Ticket |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I003-C2 | Stop merging directory into DM-32 `0x67` / `DMR-ID.csv`; keep `0x67` as channel `dmrId` only                                                               | #1220  |
| I003-C4 | Dual-bank: **stop** skipping directory rows that match a library `digitalId` on **DM-32** (OpenGD77 keep shipped). Single-bank (D890): **keep** that skip. | #1220  |

## Later encode

| Id      | Item                                                                                                                                      | Ticket |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I003-E2 | If H4 holds: DM-32 directory → `0x0F` after library, firmware cap not CPS 250; **do not** skip overlapping library `digitalId`s (P2 / C4) | #1220  |
