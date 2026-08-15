# Bank geometry (bulky reference)

Cite from findings; update when a dump contradicts. **Preliminary** — qdmr rows are reference-implementation.

Permanent homes when settled: `docs/reference/radios/opengd77/`, `docs/reference/radios/baofeng/dm-32uv/`, `docs/reference/radios/anytone/at-d890uv/`.

---

## OpenUV380 / DM-1701 — Studio programming image

`OPENUV380_FLASH_SPANS` (transferred). Gaps filled `0xff`, never sent.

| Span | Range | Contains |
| --- | --- | --- |
| 0 | `0x80`–`0x6060` | Settings, DTMF, APRS, channel bank 0 |
| 1 | `0x7500`–`0xb000` | Boot, VFO, zones |
| 2 | `0x20000`–`0x211a0` | Additional settings (keps / themes) |
| 3 | `0x9b000`–`0xaee60` | Channel banks 1–7, **DMR contacts** `0xa7620`, RX lists |

`OPENUV380_IMAGE_END` = `0xaee60`. Contacts: 1024 × `0x18` at `0xa7620`.

## OpenUV380 call-sign DB (qdmr `OpenUV380CallsignDB`)

| Item | Value | Confidence |
| --- | --- | --- |
| Header (encode) | `0x00050000` | qdmr `Offset`, not live dump |
| Segment 0 size | `0x00040000` | qdmr `size0()` |
| Segment 1 start | `0x000d8000` | qdmr `Offset::entries1()` |
| Segment 1 size | `0xd28000` | qdmr `size1()` — do not copy as entry count SoT |
| UV380 entry size | `0x1b` (27), packed text 32 chars | qdmr; official CPS may be variable-length |
| Header size | 12 bytes (`DatabaseHeaderElement`) | qdmr |
| GD-77 header (other radio) | `0x00030000` | qdmr `OpenGD77CallsignDB` |
| FirmwareInfo bit 1 | Extended callsign DB | Studio `protocol.md` |

User guide (operator): ~13 800–69 600 IDs depending on characters per entry.

**Promoted (code, not dump):** [user-database.md](../../reference/radios/opengd77/user-database.md).

## Stock DM-1701 (not OpenGD77)

qdmr `DM1701Codeplug`: second segment includes 10 000 contacts at `0x140000`. **Do not use on OpenGD77 firmware.**

## DM-32 serial (NeonPlug / Studio)

| Bank | Metadata / V-frame | Entry | Studio cap | Firmware hint |
| --- | --- | --- | --- | --- |
| Digital address book | V-frame `0x0F` | `0x5C` (92) | CPS 250 | V-frame `0x10` or L01 50 000 / 150 000 |
| Operator radio IDs | `0x67` | 16 bytes from `0x10` | 250 | 250 |
| Talk groups | `0x44` | packed | 800 | 800 |

`CONTACT_BANK_MAX_BLOCKS` = 256 (fold/write safety; L01 end near `0xFFF000` must not be walked).

## AT-D890UV (sparse `D890_MAP`)

| Bank | Base (see memory-layout.md) | Role | Cap | Directory today? |
| --- | --- | --- | --- | --- |
| Talkgroup\* | `TalkgroupData` `0x3a00000` | Library TGs / TX + RGL members | 10 000 | No |
| DigitalContact\* | Meta `0x7000000`, data `0x7900000` | Private + lookup (callsign/city/…) | 500 000 vendor | Library + directory (single-bank merge) |
| RadioId\* / MasterId | `0x3680000` / `0x3684000` | Operator TX identity | bitmap `0x20` | **No** — retain live; not a lookup DB |

Block-hopped DigitalContact data/order — see [memory-layout.md](../../reference/radios/anytone/at-d890uv/memory-layout.md).

