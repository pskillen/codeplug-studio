# AT-D890UV — satellite keps (Keplerian elements)

Standalone satellite orbital database written to the D890 for its own AOS/LOS satellite-tracking UI. Not a
per-channel field, not part of a full codeplug write. Cite: anytone-cps `Anytone::Satellite`
(`anytone-lib/include/memory/satellite.h`, `anytone-lib/src/memory/satellite.cpp`), `Device::writeSatelliteData`
/ `Device::writeRadioData` / `Device::readBootImage` family (`desktop/src/device.cpp`),
`Anytone::D890_MAP` (`anytone-lib/include/memory/anytone_memory.h`), `DeviceRWType`
(`anytone-lib/include/device_types.h`), `SatelliteTableModel` (`desktop/src/table_model/satellite_table_model.cpp`)
— facts only; do not paste GPL sources. Cross-checked against qdmr `AnytoneSatelliteConfig` /
`D168UVSatelliteConfig` (`lib/anytone_satelliteconfig.hh`, `.cc`, `lib/d168uv_satelliteconfig.hh`) — facts only.

**Hub:** [README.md](README.md) · **Erase geometry:** [flash-sectors.md](flash-sectors.md) · **Memory map:**
[memory-layout.md](memory-layout.md) · **Feature hub:** [satellite-keps](../../../../features/satellite-keps/README.md)

> **Not hardware-verified.** Everything below is reverse-engineered from GPL source (anytone-cps + qdmr) in this
> session — there was no physical AT-D890UV, no official Anytone CPS, and no USB wire capture available to this
> agent. `dev-tools/wire-capture-decoder/` exists in this repo for decoding a real capture, but no capture was
> taken. Treat every fact here as "GPL-source-inferred, needs hardware confirmation before [#856](https://github.com/pskillen/codeplug-studio/issues/856) writes to a real radio," except where a fact is independently checkable against public data (marked below).

## Region summary

| Fact             | Value                                                                         | Source                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Base address     | `0x4a80000`                                                                   | `Device::writeSatelliteData()`, `desktop/src/device.cpp:2862` — a **bare literal**, not a `D890_MAP` field |
| Stride           | `0x200` (512 bytes) per satellite                                             | Same call site                                                                                             |
| Record size      | `0x200`, zero-initialized before field writes                                 | `Anytone::Satellite::encode()`, `anytone-lib/src/memory/satellite.cpp`                                     |
| Occupancy bitmap | **None** — no `SatelliteSet` field exists anywhere in `D890_MAP`              | `anytone-lib/include/memory/anytone_memory.h` (full struct checked; no satellite entry of any kind)        |
| Write session    | Own `DeviceRWType::SATELLITE_DATA` (`= 32`) flag, independent of `RADIO_DATA` | `anytone-lib/include/device_types.h:21`; dispatch in `Device::writeRadioData()`, `desktop/src/device.cpp`  |
| Per-channel FK   | None — standalone table, no reference from `Channel` records                  | `anytone-lib/include/memory/channel.h` / `.cpp` (no satellite field)                                       |

### Base address is D890-only and resolved, not carried over from another model

`Device::writeRadioData()` dispatches on the connected radio's ident string. The `SATELLITE_DATA` branch appears
**only** inside the `ID890UV` / `V100` branch — the parallel `ID878UV2` / `V101` branch has no `SATELLITE_DATA`
check at all (`desktop/src/device.cpp`, the two `else if` arms of `writeRadioData()`). `0x4a80000` is written
unconditionally inside that D890-only branch, so it is a D890-specific address in anytone-cps's own code, even
though it's a bare literal rather than a `D890_MAP` struct field. anytone-cps does not implement satellite write
for the D878 family at all — there is no competing address to confuse it with in that source.

## Erase-unit safety — the load-bearing finding for #856

**Verdict: `0x4a80000` does not overlap BootImage / BK1Image / BK2Image, and is comfortably clear of them.**

| Region         | Base        | Erase unit (`base ÷ 0x40000`) | Length                                                                              | Occupies                           |
| -------------- | ----------- | ----------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------- |
| `BootImage`    | `0x3f80000` | **254**                       | `0xa000` (loop bound in `readBootImage`/`writeBootImage`, `desktop/src/device.cpp`) | unit 254 only (`0xa000 < 0x40000`) |
| `BK1Image`     | `0x4000000` | **256**                       | `0xa000` (`readBk1Image`/`writeBk1Image`)                                           | unit 256 only                      |
| `BK2Image`     | `0x4080000` | **258**                       | `0xa000` (`readBk2Image`/`writeBk2Image`)                                           | unit 258 only                      |
| Satellite data | `0x4a80000` | **298**                       | up to `count × 0x200`                                                               | unit 298 (see below)               |

Facts, all derived from `anytone-lib/include/memory/anytone_memory.h` (`D890_MAP` literals) and the
`readBk1Image`/`readBk2Image`/`writeBk1Image`/`writeBk2Image`/`readBootImage`/`writeBootImage` functions in
`desktop/src/device.cpp`, which all share one loop pattern (`for(int i=0; i<0xa000; i+=0x10)`) — that loop bound
is the length of all three image buffers:

- `0x4a80000 / 0x40000 = 298` exactly — the satellite base is itself erase-unit-aligned.
- `BootImage`, `BK1Image`, `BK2Image` are each `0xa000` (40 KB) long, well under one `0x40000` (256 KB) erase
  unit, and each starts exactly on a unit boundary — so each image occupies **only its own single erase unit**
  (254, 256, 258 respectively) and never spills into a neighbour.
- The satellite region starts at unit **298** — **40 erase units (10 MB) past BK2Image's unit (258)**, and units
  259–317 are entirely undeclared in `D890_MAP` (the next declared address above `BK2Image` is `LocalInfo` at
  `0x4f80000`, unit 318). Satellite data sits in that 59-unit gap, with no anytone-cps-declared neighbour on
  either side.
- At `0x200` bytes/satellite, one erase unit (`0x40000`) holds up to `0x40000 / 0x200 = 512` satellite records —
  so even an unrealistically large satellite count stays entirely inside unit 298 and never reaches unit 299.

**What this does and does not prove:** anytone-cps's own source rules out the specific concern the phase file
raised — that `BootImage`/`BK1Image`/`BK2Image` might be long enough to reach into unit 298 — because their
declared lengths (`0xa000` each) keep them inside their own single units, 40 units below the satellite base.
It does **not** prove nothing else occupies unit 298: `D890_MAP` simply has no entries at all in the 259–317
range, so anytone-cps is silent on that whole span, not clear of it. Studio should read-verify unit 298 (and
the adjoining units) before Write, matching the sparse erase-unit RMW policy already used for other regions
(preserve non-`0xff` bytes) — see [flash-sectors.md](flash-sectors.md). This is the **hardware-verification-required
gap**: nothing here says unit 298 is safe to write, only that the two named "never touch this" images from this
same GPL source don't reach it.

## Record layout (`0x200` bytes, D890)

Source: `Anytone::Satellite::encode()`, `anytone-lib/src/memory/satellite.cpp`. The `0x200`-byte buffer is
zero-initialized, then fields are written in this order. All orbital-element fields are **raw ASCII TLE
substrings** copied via `QString::mid()` in `decodeKeplerData()` and re-padded (not binary-packed Keplerian
elements) — confirmed by reading both `decodeKeplerData()` (which slices columns straight out of the two-line
element set) and `encode()` (which left/right-justifies those same strings into the record with spaces, no
binary conversion).

| Offset         | Length        | Field                                    | Encoding                                                                                                    |
| -------------- | ------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `0x00`         | 8             | Name                                     | ASCII, left-justified, space-padded (`leftJustified(8, ' ')`) — Studio-only combining rule, see note below   |
| `0x08`         | 14 (see note) | Epoch                                    | Raw TLE substring, ASCII, space-padded                                                                      |
| `0x16`         | 11            | Mean motion derivative                   | Raw TLE substring, ASCII, right-justified, space-padded                                                     |
| `0x21`         | 8             | Inclination                              | Raw TLE substring, right-justified                                                                          |
| `0x29`         | 9             | RAAN (right ascension of ascending node) | Raw TLE substring, right-justified                                                                          |
| `0x32`         | 8             | Eccentricity                             | Raw TLE substring, right-justified                                                                          |
| `0x3a`         | 9             | Argument of perigee                      | Raw TLE substring, right-justified                                                                          |
| `0x43`         | 9             | Mean anomaly                             | Raw TLE substring, right-justified                                                                          |
| `0x4c`         | 12            | Mean motion                              | Raw TLE substring, right-justified                                                                          |
| `0x58`         | 5             | Revolution number                        | Raw TLE substring, right-justified                                                                          |
| `0x60`         | 4             | RX (downlink) frequency                  | u32 **little-endian** binary int (`Int::toBytes(v, 4)`, default endian); see units note below — **not** BCD |
| `0x64`         | 4             | TX (uplink) frequency                    | u32 little-endian binary int, same units                                                                    |
| `0x68`         | 1             | CTCSS/DCS encode (uplink) type           | `0` none, `1` CTCSS, `2` DCS                                                                                |
| `0x69`         | 1             | CTCSS/DCS decode (downlink) type         | `0` none, `1` CTCSS, `2` DCS                                                                                |
| `0x6a`         | 1             | CTCSS encode tone                        | u8 index                                                                                                    |
| `0x6b`         | 1             | CTCSS decode tone                        | u8 index                                                                                                    |
| `0x6c`         | 2             | DCS encode tone                          | u16 little-endian code                                                                                      |
| `0x6e`         | 2             | DCS decode tone                          | u16 little-endian code                                                                                      |
| `0x70`–`0x1ff` | —             | Zero-filled                              | Never written by `encode()` — buffer starts as `QByteArray(0x200, 0)` and nothing after `0x70` is touched   |

### Name field — Studio-only name+label combining, not vendor-verified (#1075)

anytone-cps's own `Anytone::Satellite::encode()` writes only `name.leftJustified(8, ' ').toUtf8().mid(0,8)`
at `0x00` — a single `name` string sourced from the first line of the pasted Kepler/TLE data
(`decodeKeplerData()`'s `kD[0]`), with no separate transmitter/label field anywhere in `Anytone::Satellite`
at all. The vendor's own model has nothing to combine — one satellite record, one name string, full stop.

Studio's internal model instead has a `Satellite` with multiple `SatelliteTransmitter`s (mode, label, uplink/
downlink), so a single 8-byte name field has to represent both when useful (e.g. distinguishing a satellite's
CW beacon from its FM voice repeater). That combining behaviour is **entirely Studio's own invention** — there
is nothing in anytone-cps's source to verify it against, positively or negatively. As of #1075,
`encodeName()` (`src/integrations/radio-io/radios/at-d890uv/satelliteCodec.ts`) gives `satellite.name` first
claim on all 8 bytes; `transmitter.label` only contributes the bytes left over once the name is written,
separated by one space. When `satellite.name` alone is 8 characters or longer, the label never appears (same
as before #1075's fix) — the fix targets the case of a short name with room to spare, which previously lost
characters to the label unnecessarily via naive `` `${name} ${label}` ``-then-slice. No word-boundary
awareness is attempted; 8 bytes is judged too tight for that to reliably help, and a fixed hard-slice rule is
easier to describe accurately in the write-preview UI (`nameTruncated` flag, #1075) than a "smart" one would
be.

### Epoch field overlap — an anytone-cps encode() quirk, not a Studio assumption

`encode()` writes `epoch` as 16 bytes at `0x08` (covering `0x08`–`0x17` inclusive), then immediately writes
`mean_motion_derivative` as 11 bytes starting at `0x16` (covering `0x16`–`0x20` inclusive). Those two writes
overlap by 2 bytes (`0x16`, `0x17`) — the last 2 bytes of the epoch write are unconditionally overwritten by the
first 2 bytes of the mean-motion-derivative write. **Net effect:** only the first 14 bytes of `epoch`
(`0x08`–`0x15`) survive on the wire; the table above lists 14 as the epoch's effective length and starts
`mean_motion_derivative` at `0x16` to match what's actually on the wire, not the nominal 16-byte field width the
struct-less encode call suggests. This is read directly from the two consecutive `data.replace(...)` calls in
`encode()` — not an inference. Whether this is an anytone-cps bug (intended a 14-byte epoch, over-padded the
call) or intentional truncation to match how the D890 actually parses this field, is not determinable from source
alone.

### Frequency units — independently checkable against public satellite data

`rx_frequency`/`tx_frequency` are stored as plain little-endian `uint32`, not BCD (`Int::toBytes` defaults to
`Endian::Little` and writes a raw 4-byte int — confirmed by reading `Int::toBytes` in `anytone-lib/include/int.h`,
which is a different encoding from the channel record's BCD-as-hex RX frequency; see
[channel-record.md](channel-record.md)). The hardcoded `Anytone::SatData` table in `satellite.h` gives
`EYESAT_AO27` (AO-27) `RxFrequency = 43679500`, `TxFrequency = 14585000`. AO-27's real-world downlink/uplink are
publicly documented as 436.795 MHz / 145.850 MHz. `43679500 × 10 = 436795000` Hz and `14585000 × 10 = 145850000`
Hz — an exact match. **The stored integer is Hz ÷ 10** (i.e. deci-Hz), independent of any GPL source — this is
checkable against AO-27's public downlink/uplink frequencies, not something taken on anytone-cps's word alone.

## Occupancy and clearing behavior — unconfirmed, flag for #856

Unlike every other D890 region in [memory-layout.md](memory-layout.md) (`ChannelSet`, `ZoneSet`, `TalkgroupSet`,
…), there is **no occupancy bitmap** for satellites anywhere in `D890_MAP` — confirmed by reading the full struct
definition, not just grepping for a `SatelliteSet` name. `Device::writeSatelliteData()`
(`desktop/src/device.cpp:2854`) builds a list of satellites with `write_enable == 1`, then writes them
sequentially starting at `0x4a80000 + (i * 0x200)` for `i` from `0` to `list.size() - 1`. It never writes anything
to slots at or beyond `list.size()`, and there is no separate "count" field written anywhere in this call or
elsewhere in `D890_MAP`.

**What this means, unconfirmed:** if a previous write populated 10 satellite slots and a later write sends only
3, anytone-cps's own code does nothing to clear or mark slots 3–9 as stale — those bytes are left exactly as a
prior write left them. Two explanations are both consistent with the GPL source and neither is provable from it
alone:

1. anytone-cps has a real gap — it should clear trailing slots on write and doesn't.
2. The D890 firmware tracks a satellite count somewhere Studio (and anytone-cps) doesn't currently know about, and
   ignores slots past that count regardless of their raw bytes.

Neither anytone-cps nor qdmr (which has no D890 satellite support at all — see below) resolves this. **This is a
hardware-verification-required gap** for [#856](https://github.com/pskillen/codeplug-studio/issues/856): until
confirmed on real hardware, Studio's write path should not assume trailing slots are safely ignored — either
zero/clear the full addressable range on every satellite write, or verify against a real radio that stale
trailing entries are inert.

## Max satellite count — no firmware cap found; use qdmr's declared caps as an informed placeholder

**No max-count constant exists anywhere in anytone-cps's `Satellite`, `Memory`, or `Device` source for the D890.**
`SatelliteTableModel::rowCount()` (`desktop/src/table_model/satellite_table_model.cpp`) returns
`Anytone::Memory::satellite_data_list.size()` with no ceiling, and `writeSatelliteData()` iterates that same
unbounded list. This is a genuine absence, not something missed by a narrower grep — the whole file was read.

**anytone-cps's own default flow writes far fewer satellites than "unbounded" suggests in practice.** In
`SatelliteDialog::decodeSatelliteData()` (`desktop/src/ui/satellite_dialog.cpp`), every satellite parsed from a
CelesTrak download gets `write_enable = 1` only if `getSatData(sat_number)` (in `satellite.cpp`) finds a match —
and that lookup is a hardcoded `if`-chain against exactly 10 catalog numbers (AO-27, ISS, SAUDISAT-1C, SWISSCUBE,
LilacSat-2, and 5 named TEVEL satellites). Every other downloaded satellite gets `rx_frequency = 0` and
`write_enable = 0`, so `writeSatelliteData()` never sends it. In practice, the reference implementation this
address space was reverse-engineered from writes at most ~10 satellites per session, regardless of how many are
in the source TLE feed.

**qdmr has no D890 satellite support at all**, so it cannot directly confirm or deny a D890 cap. What it does
declare, for the Anytone models it does support:

| Model (qdmr)         | Base        | Cap                                                                            | Source                                                                              |
| -------------------- | ----------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| DMR6X2UV / DMR6X2UV2 | `0x2ec0000` | **200**                                                                        | `AnytoneSatelliteConfig::Limit::satellites()`, `lib/anytone_satelliteconfig.hh:128` |
| D168UV               | `0x2d40000` | **25**                                                                         | `D168UVSatelliteConfig::Limit::satellites()`, `lib/d168uv_satelliteconfig.hh:24`    |
| D878UV / D878UV2     | —           | **0 — satellite tracking explicitly disabled** (`_hasSatelliteConfig = false`) | `lib/d878uv_limits.cc`, `lib/d878uv2_limits.cc`                                     |

D890 appears in none of qdmr's Anytone satellite-config classes or radio files — it is simply not a qdmr-supported
target for this feature.

**Recommendation for [#856](https://github.com/pskillen/codeplug-studio/issues/856)/[#1068](https://github.com/pskillen/codeplug-studio/issues/1068):**
no D890 firmware cap is known from either GPL source. Studio should still enforce _some_ ceiling to avoid an
unbounded write into unit 298 (which — see erase-unit safety above — physically holds up to 512 records before
spilling into unit 299, an undeclared region). `AT_D890UV_LIMITS.SATELLITE_MAX` is set to **50 transmitter
records** — a Studio-chosen placeholder roughly midway between qdmr's smallest (D168UV, 25) and largest
(DMR6X2UV, 200) declared Anytone-family satellite caps in the table above, on the reasoning that a family-wide
range is a somewhat better-informed midpoint than either bound alone, though this is still **not** a D890-verified
number and should be labelled as a placeholder pending hardware confirmation, not treated as ground truth. Note
this cap counts write **records** — one per eligible `(satellite, transmitter)` pair emitted by
`packSatelliteWriteRecords` — not distinct satellites; a satellite with two enabled transmitters consumes two
slots against this limit.

## qdmr cross-check — record layout matches closely; base address cannot be directly compared

qdmr's `AnytoneSatelliteConfig::SatelliteElement` (`lib/anytone_satelliteconfig.hh`) independently declares a
`0x200`-byte record for the same tail fields (frequencies, tone types, CTCSS/DCS) at **exactly** the same offsets
as anytone-cps's D890 encode — `0x60`/`0x64` frequencies, `0x68`/`0x69` tone types, `0x6a`/`0x6b` CTCSS,
`0x6c`/`0x6e` DCS, and the same `ToneType` enum (`None=0, CTCSS=1, DCS=2`) that anytone-cps's raw ints imply.
`SatelliteElement::size()` is `0x200`, matching anytone-cps's D890 record exactly. `SatelliteElement::clear()`
memsets the first `0x50` bytes to `0x20` (ASCII space) before other fields are set — consistent with
anytone-cps's space-padded orbital-element substrings.

The middle orbital-element fields (mean motion derivative through mean anomaly) differ by a **consistent 1-byte
offset** between the two sources — qdmr's field starts are `0x17`, `0x2a`, `0x33`, `0x3b`, `0x44` where
anytone-cps's are `0x16`, `0x29`, `0x32`, `0x3a`, `0x43` — but both converge back to an exact match at
`revolution` (`0x58` in both) and stay identical for everything after. Given the epoch-field overlap documented
above, this is plausibly the same underlying wire layout described two slightly different ways by two
independent GPL implementations, not two genuinely different radios — but this is not provable from source
alone, and both sources agree closely enough (same total size, same tail layout, same field order) that this
reads as strong corroboration of the general record shape, if not a byte-exact confirmation of every offset.

**Base address — the ticket's central open question — could not be resolved by direct comparison.** qdmr simply
does not implement satellite tracking for the D890 (a search across the whole qdmr tree for `d890`/`D890UV` in
`.hh`/`.cc` files returns nothing). The two addresses the phase file asked to reconcile — anytone-cps's D890
literal `0x4a80000` and qdmr's reported `0x2ec0000` — are **not** for the same radio: `0x2ec0000` is qdmr's base
for the DMR6X2UV/DMR6X2UV2 (and, at a different address `0x2d40000`, the D168UV), models with their own,
differently-sized `D890_MAP`-equivalent address spaces in anytone-cps. There is no GPL source that states a D890
satellite base other than anytone-cps's own `0x4a80000` literal.

One indirect structural cross-check: in anytone-cps's own **D878II_MAP**, `BK2Image = 0x2b80000` and
`LocalInfo = 0x2fa0000`; qdmr's DMR6X2 satellite base `0x2ec0000` falls inside that gap, the same relative
position (between a model's `BK2Image` and `LocalInfo`) that the D890's satellite base (`0x4a80000`, between
`BK2Image = 0x4080000` and `LocalInfo = 0x4f80000`) occupies. Both families put satellite data in the gap after
the standby-picture images and before the device-info block — but the offset from `BK2Image` is not the same
multiple of the erase-unit size in both cases (13 units for the D878/DMR6X2 family's qdmr address vs. 40 units
for anytone-cps's D890 address), and neither of qdmr's two declared bases (`0x2ec0000`, `0x2d40000`) is itself
erase-unit-aligned, unlike anytone-cps's D890 literal. This is a suggestive pattern, not a formula that predicts
one address from the other — flagged here as context, not as proof `0x4a80000` is correct.

## Write-session shape

`SATELLITE_DATA = 32` is its own bit in `DeviceRWType` (`anytone-lib/include/device_types.h:21`), independent of
`RADIO_DATA = 1` (the full-codeplug write) and the three image flags. `SatelliteDialog::writeData()`
(`desktop/src/ui/satellite_dialog.cpp`) sets `adw->setReadWriteOptions(DeviceRWType::SATELLITE_DATA)` with no
other flags. `Device::writeRadioData()`'s D890 branch (`desktop/src/device.cpp`) checks each `DeviceRWType` flag
independently and calls `writeSatelliteData()` only when `SATELLITE_DATA` is set — a satellite-only write skips
`writeOtherData()` (the full codeplug body), `writeDigitalContacts()`, and all three image writes. This confirms
a satellite keps write is its own PROGRAM→ident→`W` frames→`END` session (see [protocol.md](protocol.md) for the
session shape itself), not folded into or dependent on a full codeplug write — matching the feature hub's design
goal of a lightweight, decoupled keps-update workflow (see
[satellite-keps feature hub](../../../../features/satellite-keps/README.md)).

## Ground truth (cite; do not copy)

anytone-cps and qdmr are **GPL**. Extract **facts** only — do **not** paste GPL sources into Studio.

| Source                                                                                                               | Role                                                                                          |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| anytone-cps `Anytone::Satellite` (`satellite.h`, `satellite.cpp`)                                                    | Record layout, field encoding, TLE substring extraction                                       |
| anytone-cps `Device::writeSatelliteData` / `writeRadioData` (`desktop/src/device.cpp`)                               | Base address literal, write-session dispatch, D890-only branch                                |
| anytone-cps `D890_MAP` (`anytone-lib/include/memory/anytone_memory.h`)                                               | Confirms no `SatelliteSet` field; `BootImage`/`BK1Image`/`BK2Image` bases for erase-unit math |
| anytone-cps `readBootImage`/`readBk1Image`/`readBk2Image`/`writeBk1Image`/`writeBk2Image` (`desktop/src/device.cpp`) | `0xa000` image length (loop bound), used for erase-unit safety math                           |
| anytone-cps `DeviceRWType` (`anytone-lib/include/device_types.h`)                                                    | `SATELLITE_DATA = 32`, independent of `RADIO_DATA`                                            |
| anytone-cps `SatelliteTableModel` (`desktop/src/table_model/satellite_table_model.cpp`)                              | No max-count ceiling in the row model                                                         |
| anytone-cps `Int::toBytes` (`anytone-lib/include/int.h`)                                                             | Little-endian plain-binary (not BCD) frequency encoding                                       |
| qdmr `AnytoneSatelliteConfig` (`lib/anytone_satelliteconfig.hh`, `.cc`)                                              | Record layout cross-check for DMR6X2UV/DMR6X2UV2; base `0x2ec0000`, cap 200                   |
| qdmr `D168UVSatelliteConfig` (`lib/d168uv_satelliteconfig.hh`, `.cc`)                                                | Base `0x2d40000`, cap 25, for the D168UV                                                      |
| qdmr `d878uv_limits.cc` / `d878uv2_limits.cc`                                                                        | Satellite tracking explicitly disabled for D878UV/D878UV2                                     |
| Public AO-27 (EYESAT-A) downlink/uplink frequencies                                                                  | Independent check of the Hz ÷ 10 frequency encoding — not GPL-sourced                         |
| `dev-tools/wire-capture-decoder/`                                                                                    | Available tooling for a future real wire capture — not used in this pass                      |

## Related

- [memory-layout.md](memory-layout.md) · [flash-sectors.md](flash-sectors.md) · [protocol.md](protocol.md)
- Feature hub: [satellite-keps](../../../../features/satellite-keps/README.md) — epic
  [#848](https://github.com/pskillen/codeplug-studio/issues/848)
- This ticket: [#855](https://github.com/pskillen/codeplug-studio/issues/855) · blocks
  [#856](https://github.com/pskillen/codeplug-studio/issues/856) (write path — byte offsets above are that
  ticket's real input, not placeholders)
