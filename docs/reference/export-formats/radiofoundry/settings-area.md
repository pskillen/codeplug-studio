# RadioFoundry settings area

A RadioFoundry radio keeps a 4 KB key-value store, the settings area, in its codeplug image at `0xE000`–`0xEFFF` (one EEPROM sector). It holds channel tags, including M17, and radio-wide records such as the M17 callsign. DMR Tier III, P25 and NXDN tags are still reported rather than imported. This page is the wire reference and says what Studio does with the area on each path.

Source: RadioFoundry `docs/spec/codeplug-settings.md` (sections 2, 4 and 6), `docs/spec/channel-modes.md` and `docs/spec/m17-codeplug.md`, at RadioFoundry commit `adfbfce7`. Layout constants live in `src/core/import-export/formats/radiofoundry/layout.ts`; the reader is `settingsArea.ts` and `channelTags.ts`, and the M17 block and the sector rewrite are `m17.ts` and `settingsAreaWrite.ts` in the same folder.

## Header

| Offset | Size | Field                                                                                     |
| ------ | ---- | ----------------------------------------------------------------------------------------- |
| 0      | 4    | Magic `52 46 4B 56` ("RFKV")                                                              |
| 4      | 1    | Version: 1                                                                                |
| 5      | 1    | Header length, at least 16. Entries start here (a later header may be longer)             |
| 6      | 2    | Data length (little-endian): bytes of entries after the header. Header plus data fit 4096 |
| 8      | 4    | CRC-32 (IEEE 802.3, zlib) of the data bytes only, little-endian                           |
| 12     | 4    | Reserved, not checked by version 1                                                        |

Entries are packed from the end of the header for the data length: `key` (u16 LE), `length` (u16 LE), `value[length]`. Keys `0x0000` and `0xFFFF` are not keys. There is one entry per key; a reader takes the first.

## States

| State   | When                                                                                                                | Keys read |
| ------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| `valid` | Magic, version 1, header length at least 16, header plus data within 4096, every entry inside the data, CRC matches | Yes       |
| `empty` | The whole sector is `0xFF` (erased)                                                                                 | None      |
| `newer` | Magic matches and version is above 1                                                                                | None      |
| `bad`   | Anything else, version 0 included                                                                                   | None      |

When a write puts anything that is not a valid area in that sector, the radio keeps its own valid area (spec section 6). So `0xFF` there is safe.

## Key families

A record number n sits at the family base plus n.

| Keys               | Holds                                                                |
| ------------------ | -------------------------------------------------------------------- |
| `0x0001`–`0x0009`  | Scalars                                                              |
| `0x0100`           | Systems                                                              |
| `0x0200`           | System entries                                                       |
| `0x0300`           | System secrets (never decoded by Studio)                             |
| `0x0400`–`0x07FF`  | Channel tags (key `0x0400` + channel - 1)                            |
| `0x0800`, `0x0900` | Tier III data                                                        |
| `0x0A00`           | A kind's radio-wide record. `0x0A06` is the 10-byte M17 own callsign |
| `0x1000`           | Targets                                                              |
| `0x1800`           | Target lists                                                         |
| `0x1900`–`0x1CFF`  | Traffic keys (never decoded by Studio)                               |
| `0x1D00`           | Zone tags (reserved)                                                 |

## Channel tag header

Channels are numbered 1 to 1024. Studio reads the header of every tag. For kind 6 it also reads the 7-byte M17 block. Other kinds' blocks stay unread.

| Offset | Size | Field                                                                                                                                   |
| ------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | 1    | Kind. `0` and `0xFF` mean no tag                                                                                                        |
| 1      | 1    | System index, `0xFF` for none                                                                                                           |
| 2      | 2    | Name check of the channel's stored name (LE)                                                                                            |
| 4      | 1    | Flags: bit 0 TX allowed; bit 1 the base record stands alone; bit 2 a fallback (4 bytes) follows; bit 3 reserved; bits 4 to 7 the kind's |
| 5 or 9 | rest | The kind's parameter block. Kind 6 is the M17 block below. Other kinds are not decoded                                                  |

Kinds at the pinned commit: 1 DMR Tier III trunked, 2 P25 conventional, 3 P25 trunked, 4 NXDN conventional, 5 conventional DMR AES-256, 6 M17 conventional. Studio writes kind 6. Any other id is labelled and, when the tag is live, reported as a mode Studio did not import.

### M17 block and callsign

Kind 6's block is 7 bytes and nothing follows it. Byte 0 holds the CAN in bits 0–3 and the CAN squelch in bit 4 (set means every CAN is heard). Bytes 1–6 are the destination, six bytes, big-endian base-40, first character the least significant digit. Zero, all `0xFF`, and any value from `0xEE6B28000000` up decode as no destination. A CAN above 15 is stored as 0.

Key `0x0A06` is ten bytes. A `0x00` or `0xFF` ends the callsign, trailing `0x20` bytes are discarded, and ASCII `a`–`z` fold to upper case. Ten raw bytes of a shorter callsign padded with spaces are valid. Studio writes the callsign only from the default M17 own ID. With none set, a file leaves `0x0A06` out and says whether the radio name can stand in.

## Name check

FNV-1a, 32 bit (offset basis 2166136261, prime 16777619), over the 16 octets of the name as the channel record stores it. Every octet from the first `0x00` or `0xFF` on counts as `0x00`. The check is `(h ^ (h >>> 16)) & 0xFFFF`.

| Name               | Check    |
| ------------------ | -------- |
| (empty)            | `0x706C` |
| `A`                | `0x18A9` |
| `T3 Ops`           | `0x1687` |
| `Sixteen chars!!!` | `0xCDD2` |
| `P25 Ops`          | `0x15B3` |

## Live and stale tags

A tag is live when its check equals the check of the channel's stored name and either flag bit 1 is set or the base record is DMR (`record[0x18] === 1`) and receive-only (`record[0x33] & 0x04`). Any other tag is stale: the radio keeps it and never applies it. The receive-only DMR base record is the safe stand-in for a tagged channel, since a radio that applies no tag cannot transmit on it.

## What Studio does

| Path             | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| File export      | With no M17 row, `codeplug.bin` carries `0xE000`–`0xEFFF` as `0xFF` and an info note says the radio keeps its own area. With M17 rows, the file gets a fresh sector: one kind-6 tag per kept M17 channel, and `0x0A06` when a default M17 callsign is set. Review warns that writing that file replaces the radio's settings area, and notes that M17 needs a firmware build that includes it. The ownership mask stays clear.                                                                                                         |
| Cable write      | Block `0xE000` is never sent. The cable image leaves the sector blank, so the radio keeps its own area, including tags Studio did not rewrite. A write source that owns any byte in the area is refused before a frame is sent.                                                                                                                                                                                                                                                                                                        |
| File import      | A live kind-6 tag replaces the receive-only DMR stand-in with an M17 channel. When the tag says the base stands alone, the base profile stays and M17 is added. Transmit follows the tag's TX bit. A valid `0x0A06` becomes the default M17 own ID when the import has none yet. Other live kinds are still a warning (the stand-in is what was imported). A bad or newer area is one warning and is skipped. Stale tags and other settings are counts only; `0x0A06` is not one of those other settings. An erased area says nothing. |
| Secrets and keys | Never decoded, shown, logged or stored.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## Credit

The vectors in the tests and in `__fixtures__/channel-modes.txt` come from RadioFoundry (MIT, "Copyright (c) 2026 The RadioFoundry Authors"). The licence text sits next to them as `__fixtures__/LICENSE-RadioFoundry.txt`.
