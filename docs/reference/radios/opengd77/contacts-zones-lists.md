# OpenGD77 — contacts, zones, and lists

Shared **OpenGD77Base** bank layouts. Absolute bases differ by protocol group ([memory-layout.md](memory-layout.md)); record packing is shared.

**Hub:** [README.md](README.md)

Cite: qdmr `lib/opengd77base_codeplug.hh` unless noted.

## DMR contacts

| Fact               | Value                   |
| ------------------ | ----------------------- |
| Element size       | `0x18`                  |
| Bank count         | `1024`                  |
| Name               | `0x00` (16 ASCII)       |
| Number             | `0x10` (BCD8 BE DMR ID) |
| Type               | `0x14`                  |
| Time-slot override | `0x17`                  |

### Contact type (`0x14`)

| Value | Meaning      |
| ----- | ------------ |
| `0`   | Group call   |
| `1`   | Private call |
| `2`   | All call     |

### TimeSlotOverride (`0x17`)

Encoded values noted correct for firmware ~2022-02-28 through ~2025-03-23 in qdmr comments:

| Value  | Meaning            |
| ------ | ------------------ |
| `0x00` | Force TS1          |
| `0x01` | None (use channel) |
| `0x02` | Force TS2          |

**OpenUV380 base:** FLASH `0x000a7620` · **GD-77 base:** FLASH `0x087620`

## DTMF contacts

| Fact                    | Value                                         |
| ----------------------- | --------------------------------------------- |
| Element size            | `0x20`                                        |
| Name / number           | `0x00` / `0x10`                               |
| Element Limit count     | `64`                                          |
| qdmr UI / limits.cc cap | `32` (may be stricter than raw element Limit) |

**OpenUV380 / GD-77 low base:** `0x00002f88` (FLASH on UV380; EEPROM on GD-77)

## Zones

| Fact               | Value                            |
| ------------------ | -------------------------------- |
| Zone element size  | `0xb0`                           |
| Name               | `0x00` (16 ASCII)                |
| Members            | `0x10` — u16 index+1, stride `2` |
| Members per zone   | `80`                             |
| Zone bank          | bitmap `0x00`, zones `0x20`      |
| Zone count (Limit) | `68`                             |
| Bank size          | `0x20 + 68×0xb0`                 |

Prefer Limit **68** over older Doxygen “250 zones” text.

**OpenUV380 / GD-77 low base:** `0x00008010` (FLASH on UV380; EEPROM on GD-77)

## RX group lists

| Fact              | Value                                  |
| ----------------- | -------------------------------------- |
| Element size      | `0x50`                                 |
| Name              | `0x00` (qdmr Limit name length **15**) |
| Contacts          | `0x10` — u16 stride `2`                |
| Contacts per list | `32`                                   |
| Lists             | `76`                                   |
| Bank size         | `0x1840`                               |
| Length table      | `0x00`                                 |
| Lists start       | `0x80`                                 |

**OpenUV380 base:** FLASH `0x000ad620` · **GD-77 base:** FLASH `0x08d620`

On Web Serial Write, the **entire** contact, zone, and RX group list banks are replaced from the build projection (empty projection wipes prior payload). Settings / APRS / DTMF regions stay Read-retained — see [channel-record.md](channel-record.md) Write defaults for per-channel unmodelled fields.

### Talk-group timeslot clones (Write + CSV)

When the build has `talkGroupTimeslotClones`, group contacts encode **Force TS1** (`0x00`) or **Force TS2** (`0x02`) at `0x17` on clone rows ([#764](https://github.com/pskillen/codeplug-studio/issues/764)). The library keeps one talk group; Write projects the same clone set as OpenGD77 CSV export. RX-group member indices reference **contact bank slots**, not bare DMR IDs (duplicate IDs across TS1/TS2 clones).

### Known Write gaps (organisation + channel)

| Area | Write behaviour | Notes |
| --- | --- | --- |
| Talk-group contact TS | **Encoded** via TS1/TS2 clone rows + `0x17` | Not RGL per-member override on wire |
| All-call (`type=2`) | **Not encoded** | No library All-call entity |
| Private-contact TS | **None** (`0x01`) always | No private TS policy |
| Channel APRS index / alias | **Defaults** (`0` / None) | See [channel-record.md](channel-record.md) |
| Per-channel DMR ID override | **Default** `0` | Library `dmrId` on profile not written to `0x27` |
| TOT | **Default** infinite (`0`) | Not modelled on Write |
| Empty contact / zone / RGL slots | **`0xFF` fill** + bitmap clear | Bitmap-authoritative; differs from qDMR `0` padding in some tools |

## Scan lists

Stock / Doxygen maps place scan lists in the low image (e.g. around EEPROM `0x01790`, size `0x1640`, 64 lists). qdmr’s OpenGD77 path **does not encode** scan lists and marks them ignored in limits.

For a first Studio OpenUV380 adapter: **out of scope** unless a later ticket requires them. See [memory-layout.md](memory-layout.md).

## Related

- [channel-record.md](channel-record.md) — `txContact` / `groupList` indices
- [settings-aprs.md](settings-aprs.md)
- CSV cross-check only: [contacts](../../export-formats/opengd77/contacts.md) · [zones](../../export-formats/opengd77/zones.md) · [tg-lists](../../export-formats/opengd77/tg-lists.md)
