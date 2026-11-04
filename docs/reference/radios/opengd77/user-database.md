# OpenGD77 / OpenUV380 — User Database (call-sign DB)

Firmware **DMR ID / callsign lookup** used for incoming-call display. This is **not** the 1024-slot DMR contact bank (`Contacts.csv` / FLASH `0xa7620`).

**Hub:** [README.md](README.md) · **Contacts bank:** [contacts-zones-lists.md](contacts-zones-lists.md) · **Product:** [contact-directories](../../../features/contact-directories/README.md)

Cite: qdmr `OpenUV380CallsignDB` **Offset** + `encode()` (facts only). The class comment saying start `0x30000` is GD-77 copy-paste — do not use it on 1701 / MD-9600. A 1701 **Write ACK’d** occupied sectors at these bases ([i003](../../../investigations/i003-directory-lookup-banks/README.md) `R/2026-08-15-1701-udb-ack`). Incoming-call LCD lookup and a FLASH dump are still open.

## FLASH (OpenUV380)

| Item              | Value                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| Header            | `0x00050000` (12 bytes, magic `Id`)                                                                                |
| Segment 0 entries | immediately after header; segment size `0x40000`                                                                   |
| Segment 1 entries | `0x000d8000` (overflow)                                                                                            |
| Entry size        | `0x1b` (3-byte LE DMR ID + 24 bytes packed 6-bit text, 32 chars)                                                   |
| Programming image | **not** in `OPENUV380_IMAGE_END` (`0xaee60`). Segment 0 sits in an untransferred gap; segment 1 is past the image. |

Studio Write programs **occupied sectors only** (header + packed entries). Do not copy qdmr `size1 = 0xd28000` as an entry count.

## Cardinality

| Cap           | Value                  | Notes                                                                                                                      |
| ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Contact bank  | **1024**               | Talk groups + library privates                                                                                             |
| User Database | **69 600** preliminary | User-guide range ~13 800–69 600 by chars/entry. Code: `OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX`. Packing may yield fewer. |

Library CRUD stays unlimited.

## Studio behaviour

| Path                              | Behaviour                                                                                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Serial Write · RadioID / Both | Encode directory into User Database; **do not** skip overlapping library `digitalId`s. Same-session write after the contact bank uses qdmr `write_start` (no FLASH read of `0x50000` before `'X'`). |
| Web Serial Write · Library        | Replaces 1024 contact bank only; User Database unchanged                                                                                                                                            |
| CPS zip                           | No User Database file. Directory toggle **warns** and does **not** append to `Contacts.csv` (CPS “Write DMR IDs” is a separate CPS tool)                                                            |
| Backup / Restore                  | Occupied User Database is an **inspect-only** zip region (`user-database`). Restore does not replay it. Inspect shows lookup count separately from “DMR contacts”                                   |

FirmwareInfo **features bit 1** = extended callsign DB. Studio still uses these Offset bases if the bit is clear, and warns.

## Check write

Web Serial Write checks the User Database after the radio restarts: the header and every occupied entry are read back and compared with what the Write sent (header byte for byte, entries per 4 KB sector by CRC-32). It reports under **User Database** in the check report; details in [protocol.md](protocol.md#write-verify).

## If you wrote a User Database before the transport fix

Builds before the frame-split fix could damage a Write of this size (a full database Write crossed about 36 transport boundaries), and nothing could check it. Re-write the full User Database once from a fixed build:

- **Required** after any User Database write that failed: the header count is committed first, so the tail can be stale.
- **Recommended** after writes that reported success, because nothing could confirm them. Check write now can.
- Linux attempts on earlier builds failed before FINISHing the header sector, which left the old database intact.
- Power-cycle a radio that showed a failed write before the next attempt, so a sector left open is cleared.

For the codeplug itself: re-write it once and run Check write. The Write diffs against a fresh read, so any sector that is mixed or wrong is rewritten, and an unchanged radio sends nothing. If a failed Write got past sector `0x6000` on the earliest builds, also look over the radio's menu settings (the old gap fill could wipe `0x6060`-`0x6FFF`); a successful re-Write saves the radio's settings again. Keps need nothing.

## Related

- [memory-layout.md](memory-layout.md) · [backup-restore.md](backup-restore.md) · [protocol.md](protocol.md)
- Radio homes: [DM-1701 limits](../baofeng/dm-1701/limits.md) · [MD-9600 limits](../tyt/md-9600/limits.md)
