# OpenGD77 / OpenUV380 — User Database (call-sign DB)

Firmware **DMR ID / callsign lookup** used for incoming-call display. This is **not** the 1024-slot DMR contact bank (`Contacts.csv` / FLASH `0xa7620`).

**Hub:** [README.md](README.md) · **Contacts bank:** [contacts-zones-lists.md](contacts-zones-lists.md) · **Product:** [contact-directories](../../../features/contact-directories/README.md)

Cite: qdmr `OpenUV380CallsignDB` **Offset** + `encode()` (facts only). The class comment saying start `0x30000` is GD-77 copy-paste — do not use it on 1701 / MD-9600. A 1701 **Write ACK’d** occupied sectors at these bases ([i003](../../../investigations/i003-directory-lookup-banks/README.md) `R/2026-08-15-1701-udb-ack`). Incoming-call LCD lookup and a FLASH dump are still open.

## FLASH (OpenUV380)

| Item              | Value                                                                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header            | `0x00050000` (12 bytes, magic `Id`)                                                                                                                                                                             |
| Segment 0 entries | immediately after header; segment size `0x40000`                                                                                                                                                                |
| Segment 1 entries | `0x000d8000` (overflow); the firmware does not bound it, so it runs to whatever sits above                                                                                                                      |
| Entry size        | `0x1b` (3-byte LE DMR ID + 24 bytes packed 6-bit text, 32 chars)                                                                                                                                                |
| Mode byte         | Header byte 2. `'N'` (78): 3-byte IDs, segment 1 at `0xd8000`, voice prompts kept. Studio always writes this. `'n'`: segment 1 at `0xaf400`, **overwrites the voice prompts**; gains about 1% and is never used |
| Flash above       | `0xaf400`-`0xd7fff` voice prompts; `0x100000` legacy voice-prompt slot (read only when `0xaf400` has no `VP` header); `0xe00000`-`0xffffff` GPS log (2 MiB)                                                     |
| Programming image | **not** in `OPENUV380_IMAGE_END` (`0xaee60`). Segment 0 sits in an untransferred gap; segment 1 is past the image.                                                                                              |

Studio Write programs **occupied sectors only** (header + packed entries). Do not copy qdmr `size1 = 0xd28000` as an entry count.

## Cardinality

| Cap           | Value       | Notes                                                                                                                                                                    |
| ------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contact bank  | **1024**    | Talk groups + library privates                                                                                                                                           |
| User Database | **520 646** | 9 708 entries in segment 0 plus 510 938 in segment 1, which stops at the GPS log (`0xe00000`). Code: `OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX`, derived from the layout |

The Write holds the cap lower when it must:

- **Voice prompts in the legacy slot.** Before the first sector of a Write that sends more than 15 776 entries (in a combined Write, before the codeplug sectors too), Studio reads the 8-byte voice-prompt header at `0xaf400` and at `0x100000`. The `0xaf400` copy counts only when the firmware would load it: magic `VP` and version `0x0009` (`voicePrompts.c`, `voicePromptsCheckMagicAndVersion`). Any other header there is ignored, as the firmware ignores it. If it does not count and a `VP` magic sits at `0x100000` (any version), or either read fails or comes back short, the Write stops at **15 776** entries (segment 1 ends below that slot). The Write result says why and how many rows were left out; the pre-send Review does not show it. A loadable header at `0xaf400`, or no prompts at all, allows the full cap.
- **Flash part not confirmed.** Unless FirmwareInfo reports the 16 MiB part, the Write is held to the older tested size, 69 600 entries.

A full database is about 14 MB of transfer, so the Write takes correspondingly longer. Check write reads it all back.

Library CRUD stays unlimited.

## Studio behaviour

| Path                              | Behaviour                                                                                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Serial Write · RadioID / Both | Encode directory into User Database; **do not** skip overlapping library `digitalId`s. Same-session write after the contact bank uses qdmr `write_start` (no FLASH read of `0x50000` before `'X'`). |
| Web Serial Write · Library        | Replaces 1024 contact bank only; User Database unchanged                                                                                                                                            |
| CPS zip                           | No User Database file. Directory toggle **warns** and does **not** append to `Contacts.csv` (CPS “Write DMR IDs” is a separate CPS tool)                                                            |
| Backup / Restore                  | Occupied User Database is an **inspect-only** zip region (`user-database`). Restore does not replay it. Inspect shows lookup count separately from “DMR contacts”                                   |

FirmwareInfo **features bit 1** means the database loaded at boot is in `'n'` mode: an earlier upload already overwrote the voice prompts. It is not a capability, and is clear on a normal radio. Studio warns only when it is set. Bit 2 is voice prompts loaded; `flashId` (offset 40) is the flash part.

## Check write

Web Serial Write checks the User Database after the radio restarts: the header and every occupied entry are read back and compared with what the Write sent (header byte for byte, entries per 4 KB sector by CRC-32). It reports under **User Database** in the check report; details in [protocol.md](protocol.md#write-verify).

## If you wrote a User Database before the transport fix

Builds before the frame-split fix could damage a Write of this size (a full database Write crossed about 36 transport boundaries), and nothing could check it. Re-write the full User Database once from a fixed build:

- **Required** after any User Database write that failed: the header count is committed first, so the tail can be stale.
- **Recommended** after writes that reported success, because nothing could confirm them. Check write now can.
- Linux attempts on earlier builds failed before FINISHing the header sector, which left the old database intact.
- Power-cycle a radio that showed a failed write before the next attempt, so a sector left open is cleared.

For the codeplug itself: re-write it once and run Check write. The Write diffs against a fresh read, so any sector that is mixed or wrong is rewritten, and an unchanged radio sends nothing. On a **DM-1701**, if a failed Write got past sector `0x6000` on the earliest builds, also look over the radio's menu settings (the old gap fill could wipe `0x6060`-`0x6FFF`, where that radio keeps its only copy of them); a successful re-Write saves the radio's settings again. An **MD-9600** keeps its live settings in battery RAM and rewrites the flash copy from them at every boot (`settings.c:133-163`, R20260131 MD-9600 source) and on the CPS save commands `C 06 00` / `C 06 02` (`usb_com.c:758, 802`), so a failed old-build Write is unlikely to have lost them; only a flat or removed backup battery at the same time would let it read the wiped flash copy. Keps need nothing.

## Related

- [memory-layout.md](memory-layout.md) · [backup-restore.md](backup-restore.md) · [protocol.md](protocol.md)
- Radio homes: [DM-1701 limits](../baofeng/dm-1701/limits.md) · [MD-9600 limits](../tyt/md-9600/limits.md)
