# DM-32UV — contacts, zones, and lists

Organisation and contact banks for binary codeplug memory. Caps for file adapters stay in [limits.md](limits.md); this page is wire geometry for adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638).

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `structures.ts`, `protocol.ts`, `constants.ts`.

> **Serial vs qDMR:** This page describes the **serial sparse map** used by NeonPlug and Studio Web Serial. qDMR’s virtual image reuses many metadata prefixes but different payloads — see [memory-layout.md — Two memory worlds](memory-layout.md#two-memory-worlds). Do not “fix” Studio Write from qDMR contact-bank tables.

## Contacts (address book) — V-frame `0x0F`

Separate from config-range metadata `0x0F` (RX groups).

| Fact           | Value                                             |
| -------------- | ------------------------------------------------- |
| Range source   | V-frame `0x0F` (start/end + capacity heuristics)  |
| Capacity hint  | V-frame `0x10` (u32 max) or firmware L01 fallback |
| Entry size     | **`0x5C` (92)** bytes                             |
| First block    | 16-byte header; entries from `0x10`; ~44 contacts |
| Later blocks   | Entries from `0x00`; 44 per 4KB                   |
| Empty sentinel | Name byte `0x00` or `0xFF`                        |

**Read (Web Serial):** clone download **skips** the digital address-book bank — it is not needed for the hydration stash (channels / zones / scan / TG / RX / settings). Connect still records V-frame `0x0F`/`0x10` range metadata. A count-based fold helper remains on the protocol (`foldContactBankIntoDownloadCache`) for a future contacts Read; do **not** walk V-frame start→end (L01 end near `0xFFF000` caused ~3464-block runaways).

| World                  | Contact storage                             | Record size                       |
| ---------------------- | ------------------------------------------- | --------------------------------- |
| **Serial** (this page) | V-frame `0x0F` address-book blocks          | **92** bytes (`0x5C`) per entry   |
| **qDMR virtual**       | Metadata prefix `0x44` at virtual `0x44000` | **24** bytes per `ContactElement` |

Studio Web Serial encodes the **serial** address book only.

### Contact entry (`0x5C`)

| Offset        | Field    | Notes    |
| ------------- | -------- | -------- |
| `0x00`–`0x0F` | Name     | 16 ASCII |
| `0x10`–`0x13` | DMR ID   | u32 LE   |
| `0x14`–`0x1B` | Callsign | 8 bytes  |
| `0x1C`–`0x2B` | City     | 16 ASCII |
| `0x2C`–`0x3B` | Province | 16 ASCII |
| `0x3C`–`0x4B` | Country  | 16 ASCII |
| `0x4C`–`0x5B` | Remark   | 16 ASCII |

**Studio Web Serial (#667, #685, [#1220](https://github.com/pskillen/codeplug-studio/issues/1220)):** Write **allocates** `ceil(n/44)` 4KB blocks from V-frame `0x0F` `contactsBase` (capped at `CONTACT_BANK_MAX_BLOCKS`) and includes those addresses in upload — clone **Read still skips** the bank (H6). A huge L01 `contactsEnd` is **not** treated as a clear/read span. Analog / DTMF contacts are **not** encoded — they stay as on the radio; use CPS / NeonPlug file egress to change them. RadioID directory and library privates share this bank; operator radio IDs stay metadata `0x67`.

## Talk groups — metadata `0x44` (+ counter `0x06`)

| Fact          | Value                                                           |
| ------------- | --------------------------------------------------------------- |
| Data block    | Metadata **`0x44`**                                             |
| Counter block | Metadata **`0x06`**, counter byte/word at offset **`0x1FF`**    |
| Max           | **800** ([limits.md](limits.md))                                |
| Related       | Metadata **`0x0B`** holds quick-access / sorted TG index tables |

NeonPlug `parseQuickContacts`: variable packed entries (flag + 16-char name + 3-byte DMR ID + call type). First entry may skip a leading `0x00` header byte. Prefer NeonPlug encode/parse behaviour over inventing a new packing.

| World                          | Metadata `0x44` meaning                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| **Serial** (NeonPlug / Studio) | **Talk groups** — this section                                                        |
| **qDMR virtual**               | **Contact bank** at `0x44000` — different structure; not authoritative for Web Serial |

TX-contact indices (`0x42`/`0x43`) point into the **serial** talk-group list (`0` = none).

## TX contact — metadata `0x42` / `0x43`

| Block  | Scope                                                                      |
| ------ | -------------------------------------------------------------------------- |
| `0x42` | Channels 1–2047 — 2 bytes/channel; offset `(ch − 1) × 2`                   |
| `0x43` | Channels 2048+ — offset `(ch & 0x7FF) × 2`; VFO A `0x0FFA`; VFO B `0x0FFC` |

### 2-byte entry

| Bits           | Meaning                   |
| -------------- | ------------------------- |
| Byte0 bits 7–4 | TG index high (bits 11–8) |
| Byte0 bit 0    | Digital flag              |
| Byte1          | TG index low (bits 7–0)   |

12-bit index into talk-group list (`0` = none).

## Zones — metadata `0x5c`

| Fact             | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Entry size       | **145** bytes                                                                              |
| Start offset     | **16** in first block                                                                      |
| Per-block approx | `(4096 − 16) / 145 ≈ 28`                                                                   |
| Name             | 11 bytes ASCII                                                                             |
| Members          | Count at +16; u16 LE channel numbers from +17; max **64**; unused member bytes stay `0xFF` |

### First-block header (bytes 0–15)

VFO A/B selected zone and channel indices live in the **zone bank** first block header (not settings `0x04`). Offsets cite qDMR `ZoneBankElement`; wire values are **1-based** (`0` = unset).

| Offset | Field                    |
| ------ | ------------------------ |
| `0x00` | Zone count (first block) |
| `0x01` | Channel index A          |
| `0x03` | Channel index B          |
| `0x05` | Zone index A             |
| `0x07` | Zone index B             |

**Studio Web Serial Write:** bytes 1–15 are preserved from the last Read bag, then **sanitized** — if a retained index exceeds the projected zone or channel count after a shrink, it is clamped to `1` (or cleared to `0` when the count is zero). Prevents radio UI hang when stale header values reference removed zones/channels ([#708](https://github.com/pskillen/codeplug-studio/issues/708)).

**Studio Web Serial Write (zone records):** zone blocks are filled `0xFF` then rewritten from projection; shrinking the zone list clears prior zone records. Unused zone slots in each block are explicit `0xFF` empty records (byte 16 must not remain `0xFF` — firmware may treat that as 255 members). Do **not** write a `0x0000` terminator after the last zone (NeonPlug pads with `0xFF` only).

## Scan lists — metadata `0x11`

| Fact         | Value                                  |
| ------------ | -------------------------------------- |
| Entry size   | **57** bytes                           |
| Count        | Byte at `0x00`                         |
| Entry offset | `(57 × N) − 56` for list `N` (1-based) |
| Max lists    | **32** bank / **15** channel-FK        |
| Max members  | **15** named channels                  |

**Studio Web Serial Write:** zone-derived scan lists are rewritten from projection; the block is zero-filled so shrink clears stale lists. Each exporting zone gets a `{zone} Scan` carrier channel prepended to the zone and set as designated TX. Channel-record `scanListId` is only **4 bits (1–15)** — Studio caps addressable zone-derived lists at 15 (NeonPlug parity). Shared channels keep the **first** zone’s list (not last-wins). Carriers always keep their own list id.

### 57-byte entry (summary)

| Offset  | Field                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------- |
| `+0x00` | Name (11)                                                                                                 |
| `+0x0B` | Channel count                                                                                             |
| `+0x0C` | CTC detection **0**; TX mode **1** (current) or **2** (designated TX channel) — Web Serial Write defaults |
| `+0x0D` | Hang time **50** (5.0 s) — Web Serial Write default when unmodelled                                       |
| `+0x0E` | Priority types                                                                                            |
| `+0x0F` | Priority ch 1 (u16 LE)                                                                                    |
| `+0x11` | Designated TX (encoded)                                                                                   |
| `+0x13` | Priority ch 2 (encoded)                                                                                   |
| `+0x1A` | Channel list (30 bytes, u16 LE, max 15)                                                                   |

## RX groups — metadata `0x0F`

**Not** V-frame `0x0F`.

| Fact       | Value                                         |
| ---------- | --------------------------------------------- |
| Entry size | **109** (`0x6D`)                              |
| Header     | Bitmask u32 LE at `0x00`; entries from `0x11` |
| Max groups | **32** (bitmask width)                        |
| Name       | 11 bytes at entry `+0x00`                     |
| Members    | Up to 32 × 3-byte LE DMR IDs from `+0x0B`     |

## DMR radio IDs — metadata `0x67`

| Fact         | Value                                                                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Count        | Byte at `0x00` (max **250**)                                                                                                                                                                             |
| Entries from | `0x10`                                                                                                                                                                                                   |
| Entry size   | **16** bytes                                                                                                                                                                                             |
| Channel ref  | Channel byte `0x2B` is 0-based index; `0xFF` = none — Web Serial Write builds the bank from distinct channel `ModeProfile.dmrId` values ([#687](https://github.com/pskillen/codeplug-studio/issues/687)) |

## Related

- [channel-record.md](channel-record.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- CSV cross-check: [export-formats/dm32](../../../export-formats/dm32/README.md)
