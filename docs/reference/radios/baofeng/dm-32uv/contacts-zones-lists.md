# DM-32UV — contacts, zones, and lists

Organisation and contact banks for binary codeplug memory. Caps for file adapters stay in [limits.md](limits.md); this page is wire geometry for adapter [#638](https://github.com/pskillen/codeplug-studio/issues/638).

**Hub:** [README.md](README.md) · **Memory:** [memory-layout.md](memory-layout.md)

Cite: NeonPlug `structures.ts`, `protocol.ts`, `constants.ts`.

## Contacts (address book) — V-frame `0x0F`

Separate from config-range metadata `0x0F` (RX groups).

| Fact            | Value |
| --------------- | ----- |
| Range source    | V-frame `0x0F` (start/end + capacity heuristics) |
| Entry size      | **`0x5C` (92)** bytes |
| First block     | 16-byte header; entries from `0x10`; ~44 contacts |
| Later blocks    | Entries from `0x00`; 44 per 4KB |
| Empty sentinel  | Name byte `0x00` or `0xFF` |

### Contact entry (`0x5C`)

| Offset        | Field    | Notes |
| ------------- | -------- | ----- |
| `0x00`–`0x0F` | Name     | 16 ASCII |
| `0x10`–`0x13` | DMR ID   | u32 LE |
| `0x14`–`0x1B` | Callsign | 8 bytes |
| `0x1C`–`0x2B` | City     | 16 ASCII |
| `0x2C`–`0x3B` | Province | 16 ASCII |
| `0x3C`–`0x4B` | Country  | 16 ASCII |
| `0x4C`–`0x5B` | Remark   | 16 ASCII |

## Talk groups — metadata `0x44` (+ counter `0x06`)

| Fact           | Value |
| -------------- | ----- |
| Data block     | Metadata **`0x44`** |
| Counter block  | Metadata **`0x06`**, counter byte/word at offset **`0x1FF`** |
| Max            | **800** ([limits.md](limits.md)) |
| Related        | Metadata **`0x0B`** holds quick-access / sorted TG index tables |

NeonPlug `parseQuickContacts`: variable packed entries (flag + 16-char name + 3-byte DMR ID + call type). First entry may skip a leading `0x00` header byte. Prefer NeonPlug encode/parse behaviour over inventing a new packing.

TX-contact indices (`0x42`/`0x43`) point into this TG list (`0` = none).

## TX contact — metadata `0x42` / `0x43`

| Block  | Scope |
| ------ | ----- |
| `0x42` | Channels 1–2048 — 2 bytes/channel; offset `(ch − 1) × 2` for ch 1–2047 |
| `0x43` | Channels 2049+ — offset `(ch & 0x7FF) × 2`; VFO A `0x0FFA`; VFO B `0x0FFC` |

### 2-byte entry

| Bits | Meaning |
| ---- | ------- |
| Byte0 bits 7–4 | TG index high (bits 11–8) |
| Byte0 bit 0 | Digital flag |
| Byte1 | TG index low (bits 7–0) |

12-bit index into talk-group list (`0` = none).

## Zones — metadata `0x5c`

| Fact            | Value |
| --------------- | ----- |
| Entry size      | **145** bytes |
| Start offset    | **16** in first block |
| Per-block approx| `(4096 − 16) / 145 ≈ 28` |
| Name            | 11 bytes ASCII |
| Members         | Count at +16; u16 LE channel numbers from +17; max **64** |

## Scan lists — metadata `0x11`

| Fact            | Value |
| --------------- | ----- |
| Entry size      | **57** bytes |
| Count           | Byte at `0x00` |
| Entry offset    | `(57 × N) − 56` for list `N` (1-based) |
| Max lists       | **32** |
| Max members     | **15** named channels |

### 57-byte entry (summary)

| Offset   | Field |
| -------- | ----- |
| `+0x00`  | Name (11) |
| `+0x0B`  | Channel count |
| `+0x0C`  | CTC / TX mode nibbles |
| `+0x0D`  | Hang time (tenths of s) |
| `+0x0E`  | Priority types |
| `+0x0F`  | Priority ch 1 (u16 LE) |
| `+0x11`  | Designated TX (encoded) |
| `+0x13`  | Priority ch 2 (encoded) |
| `+0x1A`  | Channel list (30 bytes, u16 LE, max 15) |

## RX groups — metadata `0x0F`

**Not** V-frame `0x0F`.

| Fact         | Value |
| ------------ | ----- |
| Entry size   | **109** (`0x6D`) |
| Header       | Bitmask u32 LE at `0x00`; entries from `0x11` |
| Max groups   | **32** (bitmask width) |
| Name         | 11 bytes at entry `+0x00` |
| Members      | Up to 32 × 3-byte LE DMR IDs from `+0x0B` |

## DMR radio IDs — metadata `0x67`

| Fact         | Value |
| ------------ | ----- |
| Count        | Byte at `0x00` (max **250**) |
| Entries from | `0x10` |
| Entry size   | **16** bytes |
| Channel ref  | Channel byte `0x2B` is 0-based index; `0xFF` = none |

## Related

- [channel-record.md](channel-record.md) · [memory-layout.md](memory-layout.md) · [settings.md](settings.md)
- CSV cross-check: [export-formats/dm32](../../../export-formats/dm32/README.md)
