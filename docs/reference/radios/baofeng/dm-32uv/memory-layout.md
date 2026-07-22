# DM-32UV — memory layout

Config memory is a **sparse 4KB-block map** inside a range announced by V-frame `0x0A`. Each block’s type is the byte at offset **`0xFFF`** (last byte of the 4KB).

**Hub:** [README.md](README.md) · **Records:** [channel-record.md](channel-record.md) · **Protocol:** [protocol.md](protocol.md)

Cite: NeonPlug `memory.ts`, `constants.ts`, `protocol.ts` (`bulkReadRequiredBlocks`).

> Classic UV-5R Mini PROGRAM+R/W packed image (`0x8240`) does **not** apply here.

## Transfer sizes

| Constant       | Value        | Role                                              |
| -------------- | ------------ | ------------------------------------------------- |
| Block size     | `4096`       | Read/write quantum                                |
| Metadata byte  | offset `0xFFF` | Type tag for the block                          |
| Channel record | `48`         | See [channel-record.md](channel-record.md)        |
| Channel packing| 84 / 85      | First channel block vs subsequent (16-byte header)|

## Config range (V-frame `0x0A`)

| Field       | Encoding   |
| ----------- | ---------- |
| Start addr  | u32 LE     |
| End addr    | u32 LE     |

NeonPlug discovery:

1. Align end down to a 4KB boundary: `alignedEnd = floor(endAddr / 0x1000) * 0x1000`.
2. For each `addr` from `startAddr` … `alignedEnd` step `0x1000`, read **1 byte** at `addr + 0xFFF`.
3. Map that byte → block type (table below).

Typical span order-of-magnitude: hundreds of 4KB blocks (~800KB when 200 blocks) — exact bounds come from the radio’s V-frame, not a fixed Studio constant.

## Metadata → type (observed)

| Metadata | NeonPlug `memory.ts` type | Notes |
| -------- | ------------------------- | ----- |
| `0x00` / `0xFF` | `empty` | Unused / unavailable |
| `0x12` … `0x41` | `channel` | Channel bank; `0x12` = first, `0x41` = last marker in constants |
| `0x5c` | `zone` | Zone bank |
| `0x11` | `scan` | Scan lists |
| `0x04` | `vfo` | Radio settings / names / embedded info |
| `0x03` | `digitalemergency` | **Discovery path** maps digital emergency here |
| `0x10` | `analogemergency` | Analog emergency; also co-hosts encryption keys (see [settings.md](settings.md)) |
| `0x0A` | `message` | Quick text messages |
| `0x02` | `calibration` | Frequency adjustment |
| `0x0F` | `rxgroup` | DMR RX groups (**metadata** `0x0F` — not V-frame `0x0F`) |
| `0x67` | `dmrradioid` | DMR radio ID list |
| `0x06` | `config` | Config section 4; TG counter at `0x1FF` |
| other | `unknown` | Still may be bulk-read if listed as required (e.g. `0x42`, `0x43`, `0x44`, `0x0B`, `0x41`) |

### NeonPlug constant vs discovery inconsistency

| Source | Digital emergency metadata |
| ------ | -------------------------- |
| `constants.ts` `METADATA.DIGITAL_EMERGENCY` | **`0x10`** |
| `memory.ts` discovery (`metadata === 0x03`) | **`0x03`** → `digitalemergency` |
| `memory.ts` (`metadata === 0x10`) | **`0x10`** → `analogemergency` |

Document **both** as observed. Do **not** “fix” NeonPlug in this docs ticket — adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638) must verify on hardware which tag the radio actually uses for digital emergency vs analog/encryption.

Bulk-read still requests `METADATA.DIGITAL_EMERGENCY` / `ANALOG_EMERGENCY` by constant (`0x10` for both names in constants) — discovery typing and constant naming diverge.

## Required / fixed blocks (bulk-read set)

NeonPlug `bulkReadRequiredBlocks` always tries to include:

| Metadata | Role |
| -------- | ---- |
| Channel blocks needed by count | First block metadata `0x12`; packing 84 then 85 — [channel-record.md](channel-record.md) |
| `0x04` | Radio settings (**critical**) |
| `0x10` | Emergency / encryption co-resident (see inconsistency note) |
| `0x41` | VFO channel bank (channels 4001/4002) |
| `0x0A` | Quick messages |
| `0x0B` | Quick-access / TG index tables (**critical** for TG UI) |
| `0x67` | DMR radio IDs |
| `0x02` | Calibration |
| `0x0F` | RX groups |
| `0x44` | Talk groups data (**critical**) |
| `0x06` | TG counter at offset `0x1FF` |
| `0x42` | TX-contact low (channels 1–2048) (**critical**) |
| `0x43` | TX-contact high (2049+ / VFOs) (**critical**) |
| all `zone` / `scan` / `message` / `dmrradioid` / `rxgroup` typed blocks | Organisation lists |

Contacts for the **address-book** bank are **not** in this config-range bulk set — they use V-frame `0x0F` range and a separate read path ([contacts-zones-lists.md](contacts-zones-lists.md)).

## Channel bank packing (summary)

| Block | Header | Channels per 4KB |
| ----- | ------ | ---------------- |
| First (`0x12`) | 16 bytes; count at `0x00` (u16 LE); channels from `0x10` | **84** |
| Subsequent | No header; channels from `0x00` | **85** |

Last channel in first block: `0x10 + 83×48 = 0xFA0`. Details: [channel-record.md](channel-record.md).

## Verification

Cross-checked against:

| Fact set | Source |
| -------- | ------ |
| Metadata constants, block sizes, offsets | NeonPlug `src/radios/dm32uv/constants.ts` |
| Discovery loop + type map | NeonPlug `memory.ts` `discoverMemoryBlocks` |
| V `0x0A` parse + bulk-read list | NeonPlug `protocol.ts` |
| Channel 84/85 packing | NeonPlug `protocol.ts` channel read |

A live radio dump is optional for this doc ticket; see [fixtures.md](fixtures.md).

## Related

- [protocol.md](protocol.md) · [channel-record.md](channel-record.md) · [contacts-zones-lists.md](contacts-zones-lists.md) · [settings.md](settings.md)
- [limits.md](limits.md) · [power.md](power.md)
