# DM-32UV — memory layout

Config memory is a **sparse 4KB-block map** inside a range announced by V-frame `0x0A`. Each block’s type is the byte at offset **`0xFFF`** (last byte of the 4KB).

**Hub:** [README.md](README.md) · **Records:** [channel-record.md](channel-record.md) · **Protocol:** [protocol.md](protocol.md)

Cite: NeonPlug `memory.ts`, `constants.ts`, `protocol.ts` (`bulkReadRequiredBlocks`).

> Classic UV-5R Mini PROGRAM+R/W packed image (`0x8240`) does **not** apply here.

## Two memory worlds

DM-32UV documentation and Studio Web Serial adapters follow **two related but distinct** memory models. Do not merge qDMR virtual tables into serial Write debugging.

| World                   | Used by                     | How blocks are found                                                                             |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| **Serial sparse map**   | NeonPlug, Studio Web Serial | V-frame `0x0A` config range + metadata byte at `block + 0xFFF`                                   |
| **qDMR codeplug image** | qDMR `.rdt` / device upload | Fixed **virtual** offsets in `DM32UVCodeplug::Offset`; metadata tag = `virtAddr >> 12` on upload |

Many metadata prefixes line up (same 4 KB quantum), but **payloads differ** — notably metadata **`0x44`**:

| Metadata   | Serial sparse map (NeonPlug / Studio)          | qDMR virtual image                                                  |
| ---------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| **`0x44`** | **Talk groups** (packed name + DMR ID entries) | **`0x44000`** = **contact bank** (24-byte `ContactElement` records) |

**Ground truth for Studio Write:** NeonPlug serial map and the tables on this page — **not** qDMR virtual offset tables. qDMR remains useful for record-layout cross-checks where structures agree.

## Sparse absolute addresses are not stable across factory reset

After a **factory reset** (or a full CPS rewrite), the radio can place ZONE / VFO / channel banks at **different absolute addresses** while keeping the same metadata tags. Studio Write is **selective-range**: it uploads only the sparse blocks from the last Read hydration, but **remaps them onto the live map before upload**.

| Hydration (example, pre-reset) | Live radio (post-reset) | Without remap (historical)                                                            |
| ------------------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| ZONE at `0x77000`              | ZONE at `0x6b000`       | User zones written to orphan address; live bank stays factory `Zone-Ana` / `Zone-Dig` |
| VFO at `0x86000`               | VFO at `0x63000`        | Startup text / key settings never update on the live settings block                   |
| SCAN at `0x62000`              | SCAN at `0x62000`       | Scan lists may still land (address unchanged)                                         |

Reset reuses each existing tag’s page. A missing tag takes the lowest free page. Later on-radio edits are copy-on-write, so absolute addresses wander. A factory reset does not write or move calibration (tag `0x02`). The reset that moves pages is Allow Reset plus SK1+SK2 at power-on. The power-cycle warning is [#1298](https://github.com/pskillen/codeplug-studio/issues/1298).

**Write behaviour (#703 + #877):** before encoding the upload image, Studio **bulk-reads live 4KB block contents** for the Write-touched / required set (`download` with progress **Pre-write read**). Address/tag discovery (`discoverDm32MemoryBlocks`) is metadata only and does **not** satisfy that content read. Overlay modelled fields onto those live bytes (not a blank `0xff` map, not OpenGD77 restore’s blank prior). `upload` still remaps by metadata tag onto live absolute addresses. No persisted stash. Restore does not use this path.

**Full Read** remains the path to refresh **unmodelled retain payloads** (settings slices not replaced by the build) from the radio — it is not required solely to learn current block addresses.

| Constant        | Value          | Role                                               |
| --------------- | -------------- | -------------------------------------------------- |
| Block size      | `4096`         | Read/write quantum                                 |
| Metadata byte   | offset `0xFFF` | Type tag for the block                             |
| Channel record  | `48`           | See [channel-record.md](channel-record.md)         |
| Channel packing | 84 / 85        | First channel block vs subsequent (16-byte header) |

## Config range (V-frame `0x0A`)

| Field      | Encoding |
| ---------- | -------- |
| Start addr | u32 LE   |
| End addr   | u32 LE   |

NeonPlug discovery:

1. Align end down to a 4KB boundary: `alignedEnd = floor(endAddr / 0x1000) * 0x1000`.
2. For each `addr` from `startAddr` … `alignedEnd` step `0x1000`, read **1 byte** at `addr + 0xFFF`.
3. Map that byte → block type (table below).

Typical span order-of-magnitude: hundreds of 4KB blocks (~800KB when 200 blocks) — exact bounds come from the radio’s V-frame, not a fixed Studio constant.

Metadata `0x02` is the calibration page only inside this V-frame `0x0A` window (block addresses from the announced start through `alignedEnd`). A 4KB page whose last byte is `0x02` outside that window is not calibration. Fonts and voice samples on a reference radio (`0x105000`, `0x116000`, `0x218000`, `0x24A000`, `0x25D000`) are those false positives and are not saved as the calibration page. When more than one in-range `0x02` page is present, the lowest address is the live page and every higher address is a duplicate.

## Metadata → type (observed)

| Metadata        | NeonPlug `memory.ts` type | Notes                                                                                     |
| --------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| `0x00` / `0xFF` | `empty`                   | Unused / unavailable                                                                      |
| `0x12` … `0x41` | `channel`                 | Channel bank; `0x12` = first, `0x41` = last marker in constants                           |
| `0x5c`–`0x64`   | `zone`                    | Zone pages in tag order (~28 each). Header only on `0x5c`; later pages pack from offset 0 |
| `0x11`          | `scan`                    | Scan lists                                                                                |
| `0x04`          | `vfo`                     | Radio settings / names / embedded info                                                    |
| `0x03`          | `unknown`                 | Unidentified payload. Not an emergency table                                              |
| `0x10`          | `analogemergency`         | Analog emergency; also co-hosts encryption keys (see [settings.md](settings.md))          |
| `0x0A`          | `message`                 | Quick text messages                                                                       |
| `0x02`          | `calibration`             | Calibration page **only inside** the V-frame `0x0A` window (see above)                    |
| `0x0F`          | `rxgroup`                 | DMR RX groups (**metadata** `0x0F` — not V-frame `0x0F`)                                  |
| `0x67`          | `dmrradioid`              | DMR radio ID list                                                                         |
| `0x06`          | `config`                  | Analogue (DTMF) contacts; count at `+0x1FF`; 32-byte records from `+0x200`                |
| `0x44`          | `unknown`                 | Talk-group page. Bulk-read because it is required. Meaning unchanged                      |
| `0x45`–`0x48`   | `unknown`                 | Present. Not read or written until a dump shows the payload                               |
| other           | `unknown`                 | Still may be bulk-read if listed as required (e.g. `0x42`, `0x43`, `0x0B`, `0x41`)        |

### Emergency and encryption tags

Firmware 048 puts emergency systems and encryption keys in tag `0x10`. Tag `0x03` is unidentified. `DIGITAL_EMERGENCY` and `ANALOG_EMERGENCY` stay `0x10`. NeonPlug’s old `0x03` → digital emergency mapping is history, not a second current mapping.

## Required / fixed blocks (bulk-read set)

NeonPlug `bulkReadRequiredBlocks` always tries to include:

| Metadata                                                                | Role                                                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Channel blocks needed by count                                          | First block metadata `0x12`; packing 84 then 85 — [channel-record.md](channel-record.md) |
| `0x04`                                                                  | Radio settings (**critical**)                                                            |
| `0x10`                                                                  | Emergency systems and encryption keys (see emergency and encryption tags)                |
| `0x41`                                                                  | VFO channel bank (channels 4001/4002)                                                    |
| `0x0A`                                                                  | Quick messages                                                                           |
| `0x0B`                                                                  | Quick-access / TG index tables (**critical** for TG UI)                                  |
| `0x67`                                                                  | DMR radio IDs                                                                            |
| `0x02`                                                                  | Calibration — every in-range page, not only the lowest address                           |
| `0x0F`                                                                  | RX groups                                                                                |
| `0x44`                                                                  | Talk groups data (**critical**)                                                          |
| `0x06`                                                                  | Analogue (DTMF) contacts; count at `+0x1FF` (retained on Write)                          |
| `0x42`                                                                  | TX-contact low (channels 1–2047) (**critical**)                                          |
| `0x43`                                                                  | TX-contact high (2048+ / VFOs) (**critical**)                                            |
| all `zone` / `scan` / `message` / `dmrradioid` / `rxgroup` typed blocks | Organisation lists                                                                       |

Contacts for the **address-book** bank are **not** in this config-range bulk set — they use V-frame `0x0F` range and a separate read path ([contacts-zones-lists.md](contacts-zones-lists.md)).

## Channel bank packing (summary)

| Block          | Header                                                   | Channels per 4KB |
| -------------- | -------------------------------------------------------- | ---------------- |
| First (`0x12`) | 16 bytes; count at `0x00` (u16 LE); channels from `0x10` | **84**           |
| Subsequent     | No header; channels from `0x00`                          | **85**           |

Last channel in first block: `0x10 + 83×48 = 0xFA0`. Details: [channel-record.md](channel-record.md).

## Write contract (Web Serial)

| Category     | Strategy                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Replaced** | Channels (+ TX-contact banks `0x42`/`0x43`), zones, scan lists, talk groups (`0x44` + quick-access `0x0B`), RX groups (`0x0F`), digital contacts (V-frame `0x0F` bank), operator DMR radio IDs (`0x67` — non-empty projection replaces the page; an empty projection is kept), APRS settings slice in `0x04` |
| **Kept**     | Radio settings (`0x04` outside APRS slice), analog/digital emergencies, encryption keys, calibration, quick messages, VFO A/B bank when not a channel bank, analogue contacts (`0x06`, echoed from Read, count byte `+0x1FF` not overwritten)                                                                |

Replaced entities encode **full records** from `RadioWriteProjection` plus NeonPlug defaults for unmodelled bytes; unused list/slot entries are explicit empty/sentinel fill ([#685](https://github.com/pskillen/codeplug-studio/issues/685)). Manifest: `dm32WriteRole` in `writeRole.ts`. Tag `0x67` stays **Replaced** when the projection has any `dmrId > 0`. An empty or non-positive projection is kept byte-for-byte ([#1291](https://github.com/pskillen/codeplug-studio/issues/1291)); that exception is an encode guard, not a move into **Kept**.

Zone pages are tags `0x5C` through `0x64` in tag order (about 28 zones each). Only `0x5C` carries the 16-byte header. Later pages pack from offset 0 and keep their own tag. When the projection does not fit on pages the radio already has, Write claims the lowest-address free page (`0x00` or `0xFF`) and stamps the next missing tag in that range once. It never stamps a second `0x5C`, and it never writes a zone page onto a block that already has any other tag. If no free page remains, or the next tag would pass `0x64`, leftover zones stay unwritten. An empty zone list does not claim a page. An already-present later zone page is bulk-read with the other zone blocks; empty pages are not.

A write that adds a zone page the radio did not already have is unsafe until the operator power-cycles. The firmware RAM tag table does not learn the new page until reboot, and the next on-radio edit can erase it. Studio does not send a reboot command. The operator warning is [#1298](https://github.com/pskillen/codeplug-studio/issues/1298).

Tag `0x44` stays the talk-group page. Tags `0x45`–`0x48` are present and are left unread and unwritten until a dump shows their payload.

## Verification

Cross-checked against:

| Fact set                                 | Source                                      |
| ---------------------------------------- | ------------------------------------------- |
| Metadata constants, block sizes, offsets | NeonPlug `src/radios/dm32uv/constants.ts`   |
| Discovery loop + type map                | NeonPlug `memory.ts` `discoverMemoryBlocks` |
| V `0x0A` parse + bulk-read list          | NeonPlug `protocol.ts`                      |
| Channel 84/85 packing                    | NeonPlug `protocol.ts` channel read         |

A live radio dump is optional for this doc ticket; see [fixtures.md](fixtures.md).

## Related

- [protocol.md](protocol.md) · [channel-record.md](channel-record.md) · [contacts-zones-lists.md](contacts-zones-lists.md) · [settings.md](settings.md)
- [limits.md](limits.md) · [power.md](power.md)
