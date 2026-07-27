# AT-D890UV — memory layout

Sparse multi‑MB codeplug regions for Anytone AT-D890UV (`D890_MAP`). There is **no** single contiguous clone image like RT95 (`0x32A0`) or UV-5R Mini (`0x8240`).

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md) · **Records:** [channel-record.md](channel-record.md) · [talkgroup-record.md](talkgroup-record.md) · [receive-group-record.md](receive-group-record.md) · [zone-record.md](zone-record.md)

> Bases below are **D890 only**. D878UVII uses a different map (`D878II_MAP`) — see [#648](https://github.com/pskillen/codeplug-studio/issues/648). Do not mix.

Cite: anytone-cps `D890_MAP` + `Device` read/write helpers — facts only; do not paste GPL sources.

## Transfer sizes

| Constant       | Value       | Role                                                                |
| -------------- | ----------- | ------------------------------------------------------------------- |
| Block size     | `0x10` (16) | Serial R/W quantum ([protocol.md](protocol.md))                     |
| Channel record | `0x80`      | Combined primary+secondary — [channel-record.md](channel-record.md) |
| Max channels   | 4000        | ChannelSet bitmap capacity / CSV limits                             |

## First-adapter region table (`D890_MAP`)

Addresses are **radio absolute** (u32). Read only enabled slots via each region’s set bitmap (except MasterId / LocalInfo).

| Region / field               | Base / value | Stride / length (facts)                        | Role                                                                                                                                                                                                                                            |
| ---------------------------- | ------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LocalInfo`                  | `0x4f80000`  | Read/write `0x100`                             | Device / local info block                                                                                                                                                                                                                       |
| `ChannelSet`                 | `0x3482a00`  | Bitmap `0x200` bytes                           | Occupied channel bits (bit = slot present)                                                                                                                                                                                                      |
| `ChannelData`                | `0x1000000`  | See address formula below                      | Channel bodies                                                                                                                                                                                                                                  |
| `ChannelDataOffset`          | `0x80`       | Entry stride within a block                    | Bytes between channel slots in a block                                                                                                                                                                                                          |
| `ChannelDataBlockSize`       | `128`        | Channels per block                             |                                                                                                                                                                                                                                                 |
| `ChannelDataBlockOffset`     | `0x80000`    | Bytes between blocks                           |                                                                                                                                                                                                                                                 |
| `ChannelDataSecondaryOffset` | `0x40`       | Primary → secondary half                       | On D890 the two halves are adjacent (`0x40`+`0x40`)                                                                                                                                                                                             |
| `ZoneSet`                    | `0x3482c00`  | Bitmap `0x20` bytes                            | Occupied zone bits                                                                                                                                                                                                                              |
| `ZoneHide`                   | `0x3482c20`  | Bitmap `0x20`                                  | Hidden-zone bits                                                                                                                                                                                                                                |
| `ZonesName`                  | `0x3600000`  | Stride `ZoneDataOffset`=`0x40`; len `0x20`     | Zone name (UTF-16 / wide on D890)                                                                                                                                                                                                               |
| `ZoneChannels`               | `0x2000000`  | Per-zone `0x200` (u16 member indices)          | Zone membership                                                                                                                                                                                                                                 |
| `ZoneAChannel`               | `0x3500400`  | Table `0x200` (u16 per zone)                   | A-channel index                                                                                                                                                                                                                                 |
| `ZoneBChannel`               | `0x3500600`  | Table `0x200` (u16 per zone)                   | B-channel index                                                                                                                                                                                                                                 |
| `RadioIdSet`                 | `0x3482c40`  | Bitmap `0x20`                                  | Radio ID occupancy                                                                                                                                                                                                                              |
| `RadioIdData`                | `0x3680000`  | Stride `0x40`; length `0x40`                   | Radio ID records                                                                                                                                                                                                                                |
| `ScanListSet`                | `0x3482c60`  | Bitmap `0x20`                                  | Scan-list occupancy                                                                                                                                                                                                                             |
| `ScanListData`               | `0x2100000`  | Stride `0x200`; length `0xd0`                  | Scan-list records — members at `+0x30` are **0-based global channel indices**; priority channels at `+0x2` / `+0x4` use the same base (`0` = Selected, `0xffff` = None)                                                                         |
| `TalkgroupSet`               | `0x3980000`  | Bitmap `0x4F0` (**inverted**: bit set → empty) | Talkgroup occupancy                                                                                                                                                                                                                             |
| `TalkgroupData`              | `0x3a00000`  | Stride `0xc8`; encode length `0xc8`            | Talkgroup records — [talkgroup-record.md](talkgroup-record.md). CPS reads `0x80` (used fields fit). Studio sparse R/W uses a **16-aligned span** covering each slot (`alignDown(base+idx*0xc8)` …) — odd indices are not 16-aligned themselves. |
| `TalkgroupOrder`             | `0x3f00000`  | Variable; 16-byte padded pairs                 | Sort / lookup table — rebuilt on every TG Write ([talkgroup-record.md](talkgroup-record.md))                                                                                                                                                    |
| `ReceiveGroupSet`            | `0x3701510`  | Bitmap `0x10`                                  | RX-group occupancy                                                                                                                                                                                                                              |
| `ReceiveGroupData`           | `0x3780000`  | Stride `0x200`; length `0x120`                 | Receive-group lists — [receive-group-record.md](receive-group-record.md) (members = talkgroup bank slot indices)                                                                                                                                |
| `MasterIdData`               | `0x3684000`  | Length `0x40`                                  | Master / default radio ID                                                                                                                                                                                                                       |

### Optional settings and alarm (Read/stash — never serial-written)

anytone-cps community RE — verify on hardware before relying on offsets. Studio **Reads** these regions on Connect/Read ([#760](https://github.com/pskillen/codeplug-studio/issues/760)) for Radio image forensics and persists them in the hydration bag. They are **not** on the serial write allow-list and are **never uploaded** ([#753](https://github.com/pskillen/codeplug-studio/issues/753)).

| Region / buffer          | Base                      | Length       | Notes                                                                                    |
| ------------------------ | ------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| Optional settings (main) | `0x3500000`               | `0x200`      | CPS language @ `+0x05` (`English`/`German` — **not** Chinese UI)                         |
| Optional settings (main) | `0x3500000`               |              | Power-on interface @ `+0x06`; power-on password enable @ `+0x07`                         |
| Optional settings (main) | `0x3500000`               |              | Startup channel @ `+0xd7`; zone A/B @ `+0xd8`/`+0xd9`; channel A/B @ `+0xda`/`+0xdb`     |
| Zone A/B tables          | `0x3500400` / `0x3500600` | `0x200` each | **Modelled** — adjacent to optional settings; on write allow-list                        |
| Optional settings (ext)  | `0x3500900`               | `0x60`       | Display lines @ `+0x00` / `+0x10` (14 chars each); power-on password @ `+0x20` (8 chars) |
| Optional settings (APRS) | `0x3501280`               | `0x30`       | GPS/APRS info — hex preview only in Studio                                               |
| Alarm settings           | `0x3482e00`               | `0x10`       | Digital call type @ `+0x00`                                                              |
| Alarm settings           | `0x3483000`               | `0x30`       | Analog/digital emergency alarm flags; man-down also @ optional main `+0x24` / `+0x4f`    |

Chinese UI on the radio is modelled in **LocalInfo ExpertOptions** (`+0x04` and `+0x05` both `0`), not optional-settings CPS language. A second hardware incident (Chinese + startup password after Write from a good hydration bag) was traced to **LocalInfo replay on upload** ([#753](https://github.com/pskillen/codeplug-studio/issues/753)) — fixed by WATCH-08 write fencing (LocalInfo is Read for preview but **not serial-written**).

### LocalInfo ExpertOptions (Read only — not written on Studio Write)

`LocalInfo` @ `0x4f80000` (`0x100` bytes) is **Read** on download for Radio image retain preview and future band validation. It is **not** on the serial write allow-list ([#753](https://github.com/pskillen/codeplug-studio/issues/753)). ExpertOptions fields (facts from anytone-cps `ExpertOptions::decode`):

| Offset           | Field                   | Notes                                  |
| ---------------- | ----------------------- | -------------------------------------- |
| `+0x02` bit 0    | Full test mode          |                                        |
| `+0x03`          | Frequency mode          | u8                                     |
| `+0x04`, `+0x05` | Chinese UI flag         | Both bytes `0` ⇒ Chinese expert chrome |
| `+0x06` bit 0    | Band select             |                                        |
| `+0x0b`          | Band-settings password  | 4 chars                                |
| `+0x10`          | Radio type              | 7 chars                                |
| `+0x28`          | Program password        | 4 chars                                |
| `+0x2c`          | Area code               | 4 chars                                |
| `+0x30`          | Serial number           | 16 chars                               |
| `+0x40`          | Production date         | 16 chars                               |
| `+0x50`          | Manufacture code        | 8 chars                                |
| `+0x60`          | Maintenance date        | 16 chars                               |
| `+0x70`          | Dealer code             | 16 chars                               |
| `+0x80`          | Stock date              | 16 chars                               |
| `+0x90`          | Sell date               | 16 chars                               |
| `+0xa0`          | Seller                  | 16 chars                               |
| `+0xb0`          | Maintenance description | 80 (`0x50`) chars                      |

`writeRole` labels LocalInfo **kept** — meaning **not re-derived from the library build** and **not serial-written** on Upload.

## Write upload contract (WATCH-08 allow-list)

Studio upload uses a **positive allow-list** (`AT_D890_WRITABLE_EXTENTS` in `writableExtents.ts`) — only modelled banks may reach the serial port. `listWriteChunks` emits cache blocks inside those extents only; `atD890WriteMemory` rejects any other address. **ChannelData** is modelled as **32 per-block backed low halves** (`0x40000` each, `0x80000` pitch) — mirrored upper-half addresses are refused ([#791](https://github.com/pskillen/codeplug-studio/issues/791)).

**Pre-Write sentinel plausibility:** before any write frames, Studio Reads six never-write spans and **refuses** the Write when any region reads entirely `0xff` (already-erased / faulted radio). Regions: `LocalInfo`; optional-settings main (`0x3500000`/`0x200`), ext (`0x3500900`/`0x60`), APRS (`0x3501280`/`0x30`); alarm bitmap (`0x3482e00`/`0x10`) and data (`0x3483000`/`0x30`). In-session pre/post compare was removed ([#769](https://github.com/pskillen/codeplug-studio/issues/769)) — reads in the same PROGRAM session return flash, not the RAM shadow. **Cross-session verify** after `END` (power-cycle + reconnect diff) is deferred to [#769](https://github.com/pskillen/codeplug-studio/issues/769) slice 5b / PR6.

**Encode guards:** MR channel encode rejects AM airband frequencies (108–137 MHz) and non-BCD-encodable Hz before bytes are packed (`channelEncodeGuards.ts`).

| Category                                                   | `writeRole`     | Re-derived from build? | Serial-written on Upload?                                  |
| ---------------------------------------------------------- | --------------- | ---------------------- | ---------------------------------------------------------- |
| Channels, zones, scan, TG, RX, radio IDs, master, TG order | `replaced`      | Yes                    | Yes (allow-listed)                                         |
| LocalInfo                                                  | `kept`          | No                     | **No** — Read for preview; pre-Write plausibility only     |
| Optional settings, alarm                                   | `kept`          | No                     | **No** — Read/stash for Radio Info; pre-Write plausibility |
| DigitalContact\*, boot images, crypto, …                   | `kept` / unread | No                     | No — absent from cache unless future Read tickets          |

**Serial Write projection (DMR bank only):** `RadioWriteProjection` for `radio-io-at-d890uv` partitions receive-only AM airband and broadcast FM out of MR channels, zones, and scan — same bank split as Anytone CSV egress ([#755](https://github.com/pskillen/codeplug-studio/issues/755)). Omitted banks stay on the radio; use Anytone CSV (`AMAir.CSV` / `FM.CSV`) to update them until binary AmAir Write exists — see [am-air.md](../../../export-formats/anytone/am-air.md). Export **Web Serial** shows an operator-facing **What Write updates** table (written vs deferred vs left alone).

Safe-skip address `0x2fa0010` (family constant) is never written. D890 `LocalInfo+0x10` (`0x4f80010`) is **not** skipped — LocalInfo is excluded from upload entirely instead.

**Operator note:** after CPS recovery or band changes, perform a **fresh Read** of the live radio before Write. Do not Write from a stale hydration YAML export — the build projection must match the radio you are connected to.

`prodWriteDisabled` remains until hardware Read→Write→Read-back clears the gate ([#741](https://github.com/pskillen/codeplug-studio/issues/741)).

Zone record detail: [zone-record.md](zone-record.md). Channel geometry: [channel-record.md](channel-record.md).

## Address aliasing

Flash address space is **not** uniformly flat. Measured on hardware 2026-07-27 (`/debug/d890-erase-probe`, `ID890UV`, 240-byte reads).

### ChannelData

| Property               | Value                                    |
| ---------------------- | ---------------------------------------- |
| Block pitch            | `0x80000` (`ChannelDataBlockOffset`)     |
| Backed bytes per block | `0x40000` (low half only)                |
| Alias stride           | `+0x40000` — upper half mirrors low half |
| Erase unit             | `0x40000`, aligned                       |

Channel writes must stay in the low half of each block; `0x1840000` physically lands on `0x1800000`. The write fence models only backed halves (`writableExtents.ts` per-block extents; `channelDataGeometry.ts`).

### Config regions

Regions that matter for erase-unit RMW ([#768](https://github.com/pskillen/codeplug-studio/issues/768)) are **flat** at `+0x40000` — base and alias candidate hold distinct cells ([#792](https://github.com/pskillen/codeplug-studio/issues/792)):

| Region                   | Base        | Alias (`+0x40000`) | Length  | Status | non-`0xff` (base / alias) |
| ------------------------ | ----------- | ------------------ | ------- | ------ | ------------------------- |
| LocalInfo                | `0x4f80000` | `0x4fc0000`        | `0x100` | flat   | 233 / 0                   |
| Optional settings (main) | `0x3500000` | `0x3540000`        | `0x200` | flat   | 512 / 512                 |
| ChannelSet               | `0x3482a00` | `0x34c2a00`        | `0x200` | flat   | 490 / 0                   |

Sparse erase-unit RMW may treat `0x3480000` and `0x3500000` units as 1:1 address → cell. Dual all-`0xff` spans would be inconclusive (not “flat”); none of the measured pairs were.

## Channel address formula

For 0-based channel index `idx`:

```text
blockIndex   = idx / 128          // ChannelDataBlockSize
indexInBlock = idx % 128
primaryAddr  = 0x1000000
             + (blockIndex * 0x80000)   // ChannelDataBlockOffset
             + (indexInBlock * 0x80)    // ChannelDataOffset
secondaryAddr = primaryAddr + 0x40      // ChannelDataSecondaryOffset
```

Read/write **64 + 64** bytes (primary then secondary) and concatenate to a **`0x80`** combined record before decode. On D890 the halves are contiguous; still treat them as two 16-aligned transfers of `0x40` (multiple of 16).

Only indices with a set bit in `ChannelSet` are present.

## Occupancy bitmaps (summary)

| Set             | Size    | Sense                                   |
| --------------- | ------- | --------------------------------------- |
| ChannelSet      | `0x200` | Bit **set** → channel slot occupied     |
| ZoneSet         | `0x20`  | Bit **set** → zone occupied             |
| RadioIdSet      | `0x20`  | Bit **set** → radio ID occupied         |
| ScanListSet     | `0x20`  | Bit **set** → scan list occupied        |
| ReceiveGroupSet | `0x10`  | Bit **set** → receive group occupied    |
| TalkgroupSet    | `0x4F0` | Bit **set** → slot **empty** (inverted) |

Bit indexing: slot `n` → byte `n // 8`, bit `n % 8`.

## Known gaps (deferred)

Not required for the first adapter; document existence only:

| Region family                         | Bases (D890)                          | Notes                             |
| ------------------------------------- | ------------------------------------- | --------------------------------- |
| Boot / BK images                      | `0x3f80000`, `0x4000000`, `0x4080000` | Large image blobs                 |
| DigitalContact\*                      | `0x7000000` …                         | Huge contact banks                |
| AES / ARC4 / EncryptionCode\*         | `0x3580000` …                         | Crypto material — treat carefully |
| AmAir / AmZone\*                      | `0x3880000` …                         | AM airband                        |
| RoamingChannel\* / RoamingZone\*      | `0x2080000` …                         | Roaming                           |
| PrefabSms\*, AnalogBook\*, GpsRoaming | various                               | Secondary features                |
| Talkgroup / digital-contact whitelist | `0x4c80000` / `0x4c82000`             | D890-specific lists               |

Full map fields live in anytone-cps `D890_MAP`; expand these pages when an adapter slice needs them.

## Verification

Cross-checked against:

| Fact set                         | Source                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Region bases / strides / lengths | anytone-cps `D890_MAP`                                                                     |
| Channel / zone address formulas  | anytone-cps `Device::readChannelData` / `readZoneData` / writers                           |
| Serial block size / framing      | anytone-cps `SerialDevice`                                                                 |
| ChannelData alias / erase unit   | Hardware probe 2026-07-27 (`/debug/d890-erase-probe`)                                      |
| Config-region flat at `+0x40000` | Hardware probe 2026-07-27 ([#792](https://github.com/pskillen/codeplug-studio/issues/792)) |

Fixtures: [fixtures.md](fixtures.md).

## Related

- [channel-record.md](channel-record.md) · [zone-record.md](zone-record.md) · [protocol.md](protocol.md)
- [limits.md](limits.md) · [power.md](power.md)
- D878UVII map (sibling): [#648](https://github.com/pskillen/codeplug-studio/issues/648)
