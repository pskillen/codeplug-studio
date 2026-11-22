# RadioFoundry settings area

A RadioFoundry radio keeps a 4 KB key-value store, the settings area, in its codeplug image at `0xE000`–`0xEFFF` (one EEPROM sector). Among other things it holds channel modes Studio cannot model yet: DMR Tier III, P25 and NXDN tags attached to channels. This page is the wire reference and says what Studio does with the area on each path.

Source: RadioFoundry `docs/spec/codeplug-settings.md` (sections 1, 2 and 6) and `docs/spec/channel-modes.md` (sections 2.1 to 2.3), at RadioFoundry commit `454a5b76`. Layout constants live in `src/core/import-export/formats/radiofoundry/layout.ts`; the reader is `settingsArea.ts` and `channelTags.ts` in the same folder.

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

| Keys               | Holds                                     |
| ------------------ | ----------------------------------------- |
| `0x0001`–`0x0009`  | Scalars                                   |
| `0x0100`           | Systems                                   |
| `0x0200`           | System entries                            |
| `0x0300`           | System secrets (never decoded by Studio)  |
| `0x0400`–`0x07FF`  | Channel tags (key `0x0400` + channel - 1) |
| `0x0800`, `0x0900` | Tier III data                             |
| `0x0A00`           | A kind's radio-wide record                |
| `0x1000`           | Targets                                   |
| `0x1800`           | Target lists                              |
| `0x1900`–`0x1CFF`  | Traffic keys (never decoded by Studio)    |
| `0x1D00`           | Zone tags (reserved)                      |

## Channel tag header

Channels are numbered 1 to 1024. Studio reads only the first five bytes of a tag.

| Offset | Size | Field                                                                                                                                   |
| ------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | 1    | Kind. `0` and `0xFF` mean no tag                                                                                                        |
| 1      | 1    | System index, `0xFF` for none                                                                                                           |
| 2      | 2    | Name check of the channel's stored name (LE)                                                                                            |
| 4      | 1    | Flags: bit 0 TX allowed; bit 1 the base record stands alone; bit 2 a fallback (4 bytes) follows; bit 3 reserved; bits 4 to 7 the kind's |
| 5 or 9 | rest | The kind's parameter block (not decoded)                                                                                                |

Kinds known at the pinned commit: 1 DMR Tier III trunked, 2 P25 conventional, 3 P25 trunked, 4 NXDN conventional. Higher ids are not settled upstream and Studio calls them "kind N (not known to Studio)".

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

| Path             | Behaviour                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File export      | `codeplug.bin` carries `0xE000`–`0xEFFF` as `0xFF`. An info note says the radio keeps its own area, and that a channel mode comes back on any channel written as receive-only DMR at the same number with the same name. |
| Cable write      | Block `0xE000` is never sent. A write source that owns any byte in the area is refused before a frame is sent. The session exposes the area it read, checked, and decoded no further than tag headers.                   |
| File import      | The area is not read yet.                                                                                                                                                                                                |
| Secrets and keys | Never decoded, shown, logged or stored.                                                                                                                                                                                  |

## Credit

The vectors in the tests and in `__fixtures__/channel-modes.txt` come from RadioFoundry (MIT, "Copyright (c) 2026 The RadioFoundry Authors"). The licence text sits next to them as `__fixtures__/LICENSE-RadioFoundry.txt`.
