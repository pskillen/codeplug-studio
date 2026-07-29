# AT-D890UV — memory layout

Sparse multi‑MB codeplug regions for Anytone AT-D890UV (`D890_MAP`). There is **no** single contiguous clone image like RT95 (`0x32A0`) or UV-5R Mini (`0x8240`).

**Hub:** [README.md](README.md) · **Protocol:** [protocol.md](protocol.md) · **Records:** [channel-record.md](channel-record.md) · [talkgroup-record.md](talkgroup-record.md) · [receive-group-record.md](receive-group-record.md) · [zone-record.md](zone-record.md) · [scan-list-record.md](scan-list-record.md)

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

| Region / field               | Base / value | Stride / length (facts)                                   | Role                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LocalInfo`                  | `0x4f80000`  | Read/write `0x100`                                        | Device / local info block                                                                                                                                                                                                                                         |
| `ChannelSet`                 | `0x3482a00`  | Bitmap `0x200` bytes                                      | Occupied channel bits (bit = slot present)                                                                                                                                                                                                                        |
| `ChannelData`                | `0x1000000`  | See address formula below                                 | Channel bodies                                                                                                                                                                                                                                                    |
| `ChannelDataOffset`          | `0x80`       | Entry stride within a block                               | Bytes between channel slots in a block                                                                                                                                                                                                                            |
| `ChannelDataBlockSize`       | `128`        | Channels per block                                        |                                                                                                                                                                                                                                                                   |
| `ChannelDataBlockOffset`     | `0x80000`    | Bytes between blocks                                      |                                                                                                                                                                                                                                                                   |
| `ChannelDataSecondaryOffset` | `0x40`       | Primary → secondary half                                  | On D890 the two halves are adjacent (`0x40`+`0x40`)                                                                                                                                                                                                               |
| `ZoneSet`                    | `0x3482c00`  | Bitmap `0x20` bytes                                       | Occupied zone bits                                                                                                                                                                                                                                                |
| `ZoneHide`                   | `0x3482c20`  | Bitmap `0x20`                                             | Hidden-zone bits                                                                                                                                                                                                                                                  |
| `ZonesName`                  | `0x3600000`  | Stride `ZoneDataOffset`=`0x40`; len `0x20`                | Zone name (UTF-16 / wide on D890)                                                                                                                                                                                                                                 |
| `ZoneChannels`               | `0x2000000`  | Per-zone `0x200` (u16 member indices)                     | Zone membership                                                                                                                                                                                                                                                   |
| `ZoneAChannel`               | `0x3500400`  | Table `0x200` (u16 per zone)                              | A-channel index                                                                                                                                                                                                                                                   |
| `ZoneBChannel`               | `0x3500600`  | Table `0x200` (u16 per zone)                              | B-channel index                                                                                                                                                                                                                                                   |
| `RadioIdSet`                 | `0x3482c40`  | Bitmap `0x20`                                             | Radio ID occupancy                                                                                                                                                                                                                                                |
| `RadioIdData`                | `0x3680000`  | Stride `0x40`; length `0x40`                              | Radio ID records                                                                                                                                                                                                                                                  |
| `ScanListSet`                | `0x3482c60`  | Bitmap `0x20`                                             | Scan-list occupancy                                                                                                                                                                                                                                               |
| `ScanListData`               | `0x2100000`  | Stride `0x200`; used through `0xF9` (encode `0xfa` today) | Scan-list records — **100** member u16s at `+0x30`…`+0xF7` (0-based global channel indices); `revert_channel` @ `+0xF8`; priority @ `+0x2` / `+0x4`: `0xffff` = Off — [scan-list-record.md](scan-list-record.md). Full stride zero-fill past `0xF9` deferred (F4) |
| `TalkgroupSet`               | `0x3980000`  | Bitmap `0x4F0` (**inverted**: bit set → empty)            | Talkgroup occupancy                                                                                                                                                                                                                                               |
| `TalkgroupData`              | `0x3a00000`  | Stride `0xc8`; encode length `0xc8`                       | Talkgroup records — [talkgroup-record.md](talkgroup-record.md). CPS reads `0x80` (used fields fit). Studio sparse R/W uses a **16-aligned span** covering each slot (`alignDown(base+idx*0xc8)` …) — odd indices are not 16-aligned themselves.                   |
| `TalkgroupOrder`             | `0x3f00000`  | Variable; 16-byte padded pairs                            | Sort / lookup table — rebuilt in the write image when talk groups are projected; staged on upload via `applyAtD890WriteImageToCache` ([talkgroup-record.md](talkgroup-record.md))                                                                                 |
| `ReceiveGroupSet`            | `0x3701510`  | Bitmap `0x10`                                             | RX-group occupancy                                                                                                                                                                                                                                                |
| `ReceiveGroupData`           | `0x3780000`  | Stride `0x200`; length `0x120`                            | Receive-group lists — [receive-group-record.md](receive-group-record.md) (members = talkgroup bank slot indices)                                                                                                                                                  |
| `MasterIdData`               | `0x3684000`  | Length `0x40`                                             | Master / default radio ID                                                                                                                                                                                                                                         |

### Optional settings and alarm (preserved through erase on Write)

anytone-cps community RE — verify on hardware before relying on offsets. Studio **Reads** these regions on Connect/Read ([#760](https://github.com/pskillen/codeplug-studio/issues/760)) for Radio image forensics and persists them in the hydration bag.

On **Write**, sparse erase-unit RMW ([#768](https://github.com/pskillen/codeplug-studio/issues/768)) **fresh-reads** each touched `0x40000` unit from the connected radio and re-stages non-`0xff` bytes unchanged — including optional settings and alarm spans that share units with modelled banks. Studio does **not** re-derive these from the library build; hydration supplies identity check only (LocalInfo serial).

| Region / buffer              | Base                      | Length       | Notes                                                                                     |
| ---------------------------- | ------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Optional settings (main)     | `0x3500000`               | `0x200`      | CPS language @ `+0x05` (`English`/`German` — **not** Chinese UI)                          |
| Optional settings (main)     | `0x3500000`               |              | Power-on interface @ `+0x06`; power-on password enable @ `+0x07`                          |
| Optional settings (main)     | `0x3500000`               |              | Startup channel @ `+0xd7`; zone A/B @ `+0xd8`/`+0xd9`; channel A/B @ `+0xda`/`+0xdb`      |
| Zone A/B tables              | `0x3500400` / `0x3500600` | `0x200` each | **Modelled** — share erase unit `0x3500000` with optional settings below                  |
| Optional settings (ext)      | `0x3500900`               | `0x60`       | Display lines @ `+0x00` / `+0x10` (14 chars each); power-on password @ `+0x20` (8 chars)  |
| Optional settings (GPS info) | `0x3501280`               | `0x30`       | Optional GPS info string — hex preview only; **not** APRS config (see [aprs.md](aprs.md)) |
| Alarm settings               | `0x3482e00`               | `0x10`       | Digital call type @ `+0x00`                                                               |
| Alarm settings               | `0x3483000`               | `0x30`       | Analog/digital emergency alarm flags; man-down also @ optional main `+0x24` / `+0x4f`     |

Chinese UI on the radio is driven by **optional settings** (CPS language, power-on password) when those regions are erased — not LocalInfo ExpertOptions. Bag diffs on a faulted radio showed LocalInfo byte-identical between healthy and faulted reads ([#768](https://github.com/pskillen/codeplug-studio/issues/768)); the brick came from erase collateral in shared flash units, not LocalInfo replay.

### APRS (binary — [#758](https://github.com/pskillen/codeplug-studio/issues/758))

Cite: anytone-cps `AprsSettings::decode_D890UV` / `encode_D890UV` — facts only. Deep field tables: [aprs.md](aprs.md).

| Region               | Base        | Length  | Write role                                          |
| -------------------- | ----------- | ------- | --------------------------------------------------- |
| `AprsConfigMain`     | `0x3501000` | `0x260` | Modelled fields re-derived; remainder RMW-preserved |
| `AprsReceiveFilters` | `0x3501300` | `0x100` | RMW-preserved (unmodelled in library)               |

Per-channel APRS bindings in MR channel record — see [channel-record.md](channel-record.md) and [aprs.md](aprs.md).

### AmAir / AmZone (AM airband — layout verified against hardware 2026-07-28)

Cite: anytone-cps `D890_MAP` for bases, **plus two hardware dumps reconciled byte-for-byte against CPS `AMAir.CSV` / `AMZone.CSV` egress** (`ID890UV`; 24 channels + VFO; 3 zones of 10/9/5 members). The two dumps share a codeplug and differ only in A-channel selection — sample 1 has every zone's A-channel on its first member, sample 2 moves them to member positions 0/1/2, which is what pins the A-channel element width. Tracked in [#756](https://github.com/pskillen/codeplug-studio/issues/756); not Read or Write in Studio today. Capacities: 256 AM channels + 1 VFO slot (index 256), 16 AM zones.

Where the reconciliation contradicts anytone-cps, the hardware wins and the discrepancy is called out — **do not port anytone-cps's AmZone code**.

| Region           | Base        | Stride / length                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ----------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `AmAirSet`       | `0x3884200` | Bitmap `0x20`                     | AM channel occupancy (256 bits), LSB-first. Verified: 24 set bits ↔ 24 CSV rows.                                                                                                                                                                                                                                                                                                                                                           |
| `AmAirData`      | `0x3880000` | Stride `0x40`; length `0x40`      | Freq BCD `+0x0` (4 bytes, digits read as hex → `MHz × 100000`; `11 90 55 00` = 119.0550) + UTF-16LE name `+0x4` (`0x20`, 16 chars). Remainder zero. Verified on all 24 records + VFO.                                                                                                                                                                                                                                                      |
| `AmAirVfo`       | `0x3884000` | `0x40`                            | VFO slot (CSV row `257`), same record shape. Outside `AmAirSet`'s 256-bit range.                                                                                                                                                                                                                                                                                                                                                           |
| `AmZoneSet`      | `0x3884400` | Bitmap `0x10`                     | Zone occupancy (16 zones), LSB-first. Verified: `0x07` ↔ 3 CSV zones.                                                                                                                                                                                                                                                                                                                                                                      |
| `AmZoneAChannel` | `0x3884600` | **`0x2` per zone** (`0x20` total) | A-channel = **u16 LE index into that zone's member list**. Both facts verified: a sample with A-channels at member positions 0/1/2 reads `00 00 01 00 02 00` — u8 would give `00 01 02`, and a global-index scheme would give 18/9/1. **anytone-cps reads u16 (correct) but writes u8**, landing zone _n_'s value on byte _n_ instead of byte _2n_; its `0x10` read length also covers only 8 of the 16 zones. Zones 8–15 not yet sampled. |
| `AmZoneScan`     | `0x3884800` | **`0x4` per zone** (`0x40` total) | One bit per **member-list position**, LSB-first — 32 bits matching the 32 member slots. Verified: `ff 03`/`ff 01`/`1f 00` ↔ 10/9/5 all-scanned members. Bit index is a member position, _not_ a global channel index (zone 0's members are globals 18,16,15,17,7,23,22,19,21,20 yet its bits are 0–9). **anytone-cps reads this at a `0x10` stride and so reads outside the zone's slice for every zone after the first.**                 |
| `AmZoneData`     | `0x3888000` | Stride `0x80`; length `0x80`      | See record table below.                                                                                                                                                                                                                                                                                                                                                                                                                    |

#### `AmZoneData` record (`0x80`)

| Offset        | Len    | Field     | Notes                                                                                                                                                                                                                                                                                 |
| ------------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x00`        | `0x22` | Zone name | UTF-16LE, max 16 chars, NUL-terminated — the terminator occupies `0x20`–`0x21` for a full-length name. This resolves the previously-unknown `0x20`–`0x22` gap: it is name padding, not a separate field (it is `0x0000` across zones of 15/12/14 chars, so it is not a member count). |
| `0x22`        | `0x40` | Members   | 32 × u16 LE global AM channel index; `0xffff` = empty slot / end of list. Verified against all three zones' member orders — the list preserves the operator's ordering, it is not sorted.                                                                                             |
| `0x62`–`0x7f` | `0x1e` | Reserved  | All-zero and byte-identical across every populated zone. Purpose unknown, but written as `0x00` (not left `0xff`), so CPS does emit it.                                                                                                                                               |

**`AmZone::encode_D890UV()` is an empty-array stub in anytone-cps** — `writeAmZones()` calls it, so a zone Write there emits an empty record while still setting the occupancy bit. The layout above is now sufficient to write our own encode, subject to the A-channel width question.

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

## Write upload contract (WATCH-08 allow-list + sparse erase-unit RMW)

Studio upload uses a **positive allow-list** (`AT_D890_WRITABLE_EXTENTS` in `writableExtents.ts`) to define what Studio may **change** from the library build. `listWriteChunks` still emits only modelled banks; **sparse erase-unit RMW** ([#768](https://github.com/pskillen/codeplug-studio/issues/768)) may **transmit** unchanged bytes inside touched `0x40000` units so co-resident optional settings and alarms survive flash erase. `atD890WriteMemory` uses a touched-unit transmit fence during upload; LocalInfo’s unit is never touched so LocalInfo is never serial-written.

**Sparse RMW flow (upload):** compute touched erase units from modelled write addresses → fresh-read each unit from the connected radio → identity-check LocalInfo serial against hydration → overlay modelled chunks → stage only non-`0xff` 16-byte blocks → `END` commits.

**ChannelData** is modelled as **32 per-block backed low halves** (`0x40000` each, `0x80000` pitch) — mirrored upper-half addresses are refused ([#791](https://github.com/pskillen/codeplug-studio/issues/791)).

**Pre-Write sentinel plausibility:** before any write frames, Studio Reads six never-write spans and **refuses** the Write when any region reads entirely `0xff` (already-erased / faulted radio). Regions: `LocalInfo`; optional-settings main (`0x3500000`/`0x200`), ext (`0x3500900`/`0x60`), APRS (`0x3501280`/`0x30`); alarm bitmap (`0x3482e00`/`0x10`) and data (`0x3483000`/`0x30`). In-session pre/post compare was removed ([#769](https://github.com/pskillen/codeplug-studio/issues/769)) — reads in the same PROGRAM session return flash, not the RAM shadow. **Cross-session verify** after `END` is optional in the build **Direct radio** UI: wait for the radio to finish its automatic restart, reconnect, and diff those spans against the pre-Write snapshot ([#769](https://github.com/pskillen/codeplug-studio/issues/769) slice 5b).

**Encode guards:** MR channel encode rejects AM airband frequencies (108–137 MHz) and non-BCD-encodable Hz before bytes are packed (`channelEncodeGuards.ts`).

| Category                                                   | `writeRole`     | Re-derived from build? | On Upload                                                                                                                                  |
| ---------------------------------------------------------- | --------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Channels, zones, scan, TG, RX, radio IDs, master, TG order | `replaced`      | Yes                    | Written from build (allow-listed)                                                                                                          |
| APRS global config + channel APRS bits                     | `replaced`      | Partial                | Modelled digital fields from library; unmodelled bytes RMW-preserved ([#758](https://github.com/pskillen/codeplug-studio/issues/758))      |
| AM airband channels + AM zones                             | `replaced`      | When projected         | Written together when build has airband zones; else radio bank left alone ([#756](https://github.com/pskillen/codeplug-studio/issues/756)) |
| LocalInfo                                                  | `kept`          | No                     | **Not transmitted** — identity check only; unit not touched                                                                                |
| Optional settings, alarm                                   | `kept`          | No                     | **Preserved** — fresh-read + unchanged re-stage inside touched units                                                                       |
| DigitalContact\*, boot images, crypto, broadcast FM, …     | `kept` / unread | No                     | Untouched — absent from cache unless future Read tickets                                                                                   |

**Serial Write projection:** `RadioWriteProjection` for `radio-io-at-d890uv` partitions receive-only AM airband and broadcast FM out of MR channels, zones, and scan — same bank split as Anytone CSV egress ([#755](https://github.com/pskillen/codeplug-studio/issues/755)). **AM airband** then projects into the parallel `AmAir*` / `AmZone*` banks when the build has airband channels **and** AM zone membership (zones ship with channels). Empty airband content retains the radio bank (DigitalContacts-style). Broadcast FM stays CSV-only until a later ticket — see [am-air.md](../../../export-formats/anytone/am-air.md). Export **Web Serial** shows an operator-facing **What Write updates** table (written vs deferred vs left alone).

**AmAir erase unit:** `AmAirData` (`0x3880000`) and `AmZoneData` (`0x3888000`) share erase unit `0x3880000`. Sparse RMW fresh-reads the unit when airband is written.

Safe-skip address `0x2fa0010` (family constant) is never written. D890 `LocalInfo+0x10` (`0x4f80010`) is **not** skipped — LocalInfo is excluded from upload entirely instead.

**Operator note:** after CPS recovery or band changes, perform a **fresh Read** of the live radio before Write. Do not Write from a stale hydration YAML export — the build projection must match the radio you are connected to.

Web Serial Write is available on production deploys ([#800](https://github.com/pskillen/codeplug-studio/issues/800)).

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

### TalkgroupData (unverified mirror — [#829](https://github.com/pskillen/codeplug-studio/issues/829))

2026-07-28 memory dump: window at `0x3a40000` is a **byte-for-byte mirror** of `0x3a00000` (same geometry class as `ChannelData` above). Studio still models a flat `TalkgroupData` bank until erase-probe confirms pitch and backed length; do not raise `TALK_GROUPS_MAX` or change writable extents without hardware verification.

### Config regions

Regions that matter for erase-unit RMW ([#768](https://github.com/pskillen/codeplug-studio/issues/768)) are **flat** at `+0x40000` — base and alias candidate hold distinct cells ([#792](https://github.com/pskillen/codeplug-studio/issues/792)):

| Region                   | Base        | Alias (`+0x40000`) | Length  | Status | non-`0xff` (base / alias) |
| ------------------------ | ----------- | ------------------ | ------- | ------ | ------------------------- |
| LocalInfo                | `0x4f80000` | `0x4fc0000`        | `0x100` | flat   | 233 / 0                   |
| Optional settings (main) | `0x3500000` | `0x3540000`        | `0x200` | flat   | 512 / 512                 |
| ChannelSet               | `0x3482a00` | `0x34c2a00`        | `0x200` | flat   | 490 / 0                   |

Sparse erase-unit RMW may treat `0x3480000` and `0x3500000` units as 1:1 address → cell. Dual all-`0xff` spans would be inconclusive (not “flat”); none of the measured pairs were.

## Flash erase unit

Measured in `ChannelData` 2026-07-27 (`/debug/d890-erase-probe`, `ID890UV`): **`0x40000` (256 kB), aligned**. Writing any 16-byte block into a unit erases the whole unit at `END`; only bytes staged in the same PROGRAM session survive.

| Erase unit base | Modelled writes (examples)                                       | Co-resident regions preserved by sparse RMW        |
| --------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| `0x3480000`     | `ChannelSet`, `ZoneSet`, `ZoneHide`, `RadioIdSet`, `ScanListSet` | `AlarmBitmap` `0x3482e00`, `AlarmData` `0x3483000` |
| `0x3500000`     | `ZoneAChannel`, `ZoneBChannel`                                   | Optional settings main/ext/APRS `0x3500000`…       |
| `0x3880000`     | `AmAir*` / `AmZone*` (when airband projected)                    | AmAir VFO + unmodelled co-residents in the unit    |
| `0x1000000`+    | `ChannelData` (per backed block)                                 | Unused slots in same unit                          |

**Sparse staging:** only non-`0xff` 16-byte blocks are re-transmitted (~37.5 kB across 14 touched units in a typical codeplug, vs 3.67 MB dense). Fresh-read source is the **connected radio**, not the hydration bag; LocalInfo serial must match the stash or Write is refused.

`LocalInfo` (`0x4f80000`) sits in unit `0x4f80000` — outside the modelled write set — so it is never transmitted.

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

| Region family                         | Bases (D890)                          | Notes                                                              |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| Boot / BK images                      | `0x3f80000`, `0x4000000`, `0x4080000` | Large image blobs                                                  |
| DigitalContact\*                      | `0x7000000` …                         | Huge contact banks — see the DigitalContact section below          |
| AES / ARC4 / EncryptionCode\*         | `0x3580000` …                         | Crypto material — treat carefully                                  |
| AmAir / AmZone\*                      | `0x3880000` …                         | AM airband — layout verified; see the AmAir / AmZone section above |
| RoamingChannel\* / RoamingZone\*      | `0x2080000` …                         | Roaming                                                            |
| PrefabSms\*, AnalogBook\*, GpsRoaming | various                               | Secondary features                                                 |
| Talkgroup / digital-contact whitelist | `0x4c80000` / `0x4c82000`             | D890-specific lists                                                |

Full map fields live in anytone-cps `D890_MAP`; expand these pages when an adapter slice needs them.

### DigitalContact (huge bank — layout only; Read/decode exist, Studio Write is a deliberate v1 gap)

Cite: anytone-cps `D890_MAP`, `Device::readDigitalContacts` / `parseDigitalContact_D890UV` / `writeDigitalContacts` — facts only. Tracked in [#759](https://github.com/pskillen/codeplug-studio/issues/759); Studio never Reads or Writes this bank ([#753](https://github.com/pskillen/codeplug-studio/issues/753) allow-list). The layout itself is fully known upstream (unlike AmZone) — the open question is product policy (replace-vs-merge, never-wipe-on-empty), not RE.

| Region                | Base        | Block length / stride             | Notes                                                                                                                                                           |
| --------------------- | ----------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DigitalContactMeta`  | `0x7000000` | `0x10`                            | `u32` contact count @ `+0x0`, `u32` end address (post block-hop) @ `+0x4`, `0x8` padding                                                                        |
| `DigitalContactData`  | `0x7900000` | Block `0x30d40`; stride `0x80000` | Variable-length records: call type, call-alert flag, BCD radio ID, then name/city/callsign/state/country/remarks as wide-char strings each terminated by `\0\0` |
| `DigitalContactOrder` | `0x7080000` | Block `0x3e800`; stride `0x80000` | Sort/lookup table, `0x8` bytes/contact (`(radio_id<<1)\|call_type` key + data offset), rebuilt on every Write, `0xff`-padded to 16 bytes                        |

Both `DigitalContactData` and `DigitalContactOrder` are **block-hopped**: logical byte `i` maps to `base + floor(i / blockLength) * stride + (i % blockLength)` — a linear record stream de-interleaved across `0x80000`-spaced physical blocks. The debug memory-export tool below reconstructs this linear stream (using the count from `DigitalContactMeta`) rather than dumping the raw sparse address range, which is mostly unused space between blocks.

## Debug memory-region export (`/debug/d890-erase-probe`)

Read-only raw-binary export of every region documented on this page, for offline diffing against codeplugs written by the official Anytone CPS — this is the read-only differential RE workflow for AmZone encode and any other undocumented byte ranges, not a modelled Read/Write path. Regions are grouped into higher-level areas (Device, Optional settings & alarm, APRS, Channels, Zones, Scan lists, Talkgroups, RX groups, Radio IDs, Airband) — each region's address/size is still listed individually, but export happens at group granularity:

- One button per group — zips every region in that group into a single download.
- **Export all (excl. Digital Contacts)** — every region above regardless of group, except `DigitalContact*`, zipped together (contacts are excluded because the block-hopped bank is large and slow relative to everything else).
- **Export Digital Contacts** — meta + de-interleaved order table + de-interleaved contact data, zipped separately.

Filenames are stamped with the export time in ISO 8601 (colons/periods replaced with `-` for filesystem safety). Nothing here is on the write allow-list; the tool only issues `R` frames.

## Verification

Cross-checked against:

| Fact set                         | Source                                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Region bases / strides / lengths | anytone-cps `D890_MAP`                                                                                                                      |
| Channel / zone address formulas  | anytone-cps `Device::readChannelData` / `readZoneData` / writers                                                                            |
| Serial block size / framing      | anytone-cps `SerialDevice`                                                                                                                  |
| ChannelData alias / erase unit   | Hardware probe 2026-07-27 (`/debug/d890-erase-probe`)                                                                                       |
| Config-region flat at `+0x40000` | Hardware probe 2026-07-27 ([#792](https://github.com/pskillen/codeplug-studio/issues/792))                                                  |
| AmAir / AmZone record layouts    | Hardware dump 2026-07-28 reconciled against CPS `AMAir.CSV` / `AMZone.CSV` ([#756](https://github.com/pskillen/codeplug-studio/issues/756)) |

Fixtures: [fixtures.md](fixtures.md).

## Related

- [channel-record.md](channel-record.md) · [zone-record.md](zone-record.md) · [protocol.md](protocol.md)
- [limits.md](limits.md) · [power.md](power.md)
- D878UVII map (sibling): [#648](https://github.com/pskillen/codeplug-studio/issues/648)
