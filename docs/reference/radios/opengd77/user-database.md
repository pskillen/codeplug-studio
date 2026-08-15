# OpenGD77 / OpenUV380 — User Database (call-sign DB)

Firmware **DMR ID / callsign lookup** used for incoming-call display. This is **not** the 1024-slot DMR contact bank (`Contacts.csv` / FLASH `0xa7620`).

**Hub:** [README.md](README.md) · **Contacts bank:** [contacts-zones-lists.md](contacts-zones-lists.md) · **Product:** [contact-directories](../../../features/contact-directories/README.md)

Cite: qdmr `OpenUV380CallsignDB` **Offset** + `encode()` (facts only). The class comment saying start `0x30000` is GD-77 copy-paste — do not use it on 1701 / MD-9600. Addresses are **preliminary until a live dump** ([#1211](https://github.com/pskillen/codeplug-studio/issues/1211), i003).

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

| Path                              | Behaviour                                                                                                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Serial Write · RadioID / Both | Encode directory into User Database; **do not** skip overlapping library `digitalId`s                                                                             |
| Web Serial Write · Library        | Replaces 1024 contact bank only; User Database unchanged                                                                                                          |
| CPS zip                           | No User Database file. Directory toggle **warns** and does **not** append to `Contacts.csv` (CPS “Write DMR IDs” is a separate CPS tool)                          |
| Backup / Restore                  | Occupied User Database is an **inspect-only** zip region (`user-database`). Restore does not replay it. Inspect shows lookup count separately from “DMR contacts” |

FirmwareInfo **features bit 1** = extended callsign DB. Studio still uses these Offset bases if the bit is clear, and warns.

## Related

- [memory-layout.md](memory-layout.md) · [backup-restore.md](backup-restore.md) · [protocol.md](protocol.md)
- Radio homes: [DM-1701 limits](../baofeng/dm-1701/limits.md) · [MD-9600 limits](../tyt/md-9600/limits.md)
