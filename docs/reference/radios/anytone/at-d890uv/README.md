# Anytone AT-D890UV

Handheld multi-mode radio (DMR + analogue + AM air + broadcast FM). Studio targets it via Anytone CPS CSV and (planned) Web Serial direct-write.

|                  |                    |
| ---------------- | ------------------ |
| **Manufacturer** | Anytone            |
| **Model**        | AT-D890UV          |
| **CPS**          | Anytone CPS CSV    |
| **Ident**        | `ID890UV` / `V100` |

Sibling variants (AT-D878UV II, AT-D578UV, …) share the Anytone DMR R/W family but have **different** region maps — see [#648](https://github.com/pskillen/codeplug-studio/issues/648) for D878UVII. Do not reuse this page’s bases for those models.

> **CPS CSV wire ≠ device binary regions.** File interchange lives under [export-formats/anytone](../../../export-formats/anytone/README.md). Handshake, sparse memory maps, and channel/zone records live in the binary docs below.

Provisional CSV caps mirror `profiles.ts` (`ANYTONE_PROFILES`); still verify against CPS manual before treating as hard radio caps.

**Product hub:** [radio-read-write](../../../../features/radio-read-write/README.md) · **Tracking:** [#647](https://github.com/pskillen/codeplug-studio/issues/647) (blocks adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649); parent epic [#645](https://github.com/pskillen/codeplug-studio/issues/645))

## Studio profile ids

| Adapter     | `profileId`          | Notes                                                                                                       |
| ----------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Anytone CSV | `anytone-at-d890uv`  | Epic [#228](https://github.com/pskillen/codeplug-studio/issues/228)                                         |
| Web Serial  | `radio-io-at-d890uv` | Direct radio egress on `anytone-at-d890uv` ([#649](https://github.com/pskillen/codeplug-studio/issues/649)) |

## Documentation map

| Doc                                                | Contents                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [limits.md](limits.md)                             | Channels, zone/scan/RGL members, names, APRS slots, VFO rows (file-adapter truth)                                            |
| [capabilities.md](capabilities.md)                 | Feature / bank export availability                                                                                           |
| [power.md](power.md)                               | Low / Mid / High / Turbo ladder                                                                                              |
| [protocol.md](protocol.md)                         | Baud 921600, PROGRAM→QX, ident, ASCII R/W + u32 BE, checksum, END, safe-skip address                                         |
| [memory-layout.md](memory-layout.md)               | `D890_MAP` region table (first-adapter subset) + address formulas                                                            |
| [channel-record.md](channel-record.md)             | 0x80 combined channel (0x40+0x40); address formula; ChannelSet bitmap                                                        |
| [aprs.md](aprs.md)                                 | Global APRS `0x3501000`, receive filters, channel APRS bits ([#758](https://github.com/pskillen/codeplug-studio/issues/758)) |
| [talkgroup-record.md](talkgroup-record.md)         | Stride `0xc8`; BCD-as-hex DMR ID; call type 0/1/2; inverted TalkgroupSet                                                     |
| [receive-group-record.md](receive-group-record.md) | Stride `0x200`; u32 LE talkgroup bank slot indices; wide-char name at `0x100`                                                |
| [zone-record.md](zone-record.md)                   | ZoneSet / ZonesName / ZoneChannels / A/B indices                                                                             |
| [scan-list-record.md](scan-list-record.md)         | ScanListData record layout (100 members; revert @ `0xF8`)                                                                    |
| [fixtures.md](fixtures.md)                         | How to capture dumps for tests without committing personal codeplugs                                                         |

## Adapter wire (files)

- [Anytone export-format](../../../export-formats/anytone/README.md) — columns / traits (**not** binary offsets)
- Feature hub: [import-export/anytone](../../../../features/import-export/anytone/README.md)

## Direct read/write (binary)

Anytone DMR PROGRAM→QX session at **921600** baud with **u32 BE** addresses and sparse multi‑MB regions. See the binary docs in the map above. Kit codec: `src/integrations/radio-io/kit/codecs/anytoneDmrRw.ts` ([#646](https://github.com/pskillen/codeplug-studio/issues/646)). Adapter: `src/integrations/radio-io/radios/at-d890uv/` ([#649](https://github.com/pskillen/codeplug-studio/issues/649) — shipped).

**Write contract (v1, WATCH-08):** Studio **replaces** channels, zones, scan lists, talk groups (including TalkgroupOrder), RX groups, operator radio IDs, master radio ID, **digital APRS** globals + per-channel bindings (modelled fields only — see [aprs.md](aprs.md)), and **AM airband channels + AM zones** (when the build projects both — zones ship with channels) from `assemble` + `RadioWriteProjection` ([#758](https://github.com/pskillen/codeplug-studio/issues/758), [#756](https://github.com/pskillen/codeplug-studio/issues/756)). Serial Write keeps AM airband and broadcast FM **out of MR** slots ([#755](https://github.com/pskillen/codeplug-studio/issues/755)); airband goes to the parallel `AmAir*` / `AmZone*` banks, and a build with no airband content **leaves the radio AM bank alone**. **Zone-derived scan lists** apply to the **DMR bank only** — AmZone scan on the radio is the separate `AmZoneScan` bitmap, not `exportScanList` / scan carriers ([#823](https://github.com/pskillen/codeplug-studio/issues/823)). Review projected AM channels and zones on the build **AM airband** wire-preview page (Anytone CSV and Web Serial) — [wire-preview hub](../../../../features/builds/wire-preview.md) ([#824](https://github.com/pskillen/codeplug-studio/issues/824)). Broadcast FM remains CSV-only. Upload is fenced to an explicit **allow-list** of modelled bank extents ([#753](https://github.com/pskillen/codeplug-studio/issues/753)) — `listWriteChunks` and `atD890WriteMemory` reject anything outside that list. **LocalInfo** and **optional settings / alarm** are Read for Radio image forensics ([#760](https://github.com/pskillen/codeplug-studio/issues/760)) but **not serial-written**; pre-Write sentinel plausibility refuses all-`0xff` never-write regions ([#769](https://github.com/pskillen/codeplug-studio/issues/769)); failed uploads abandon PROGRAM without `END`. Optional **Check preserved settings** after Write reconnects and diffs never-write spans against the pre-Write snapshot ([#769](https://github.com/pskillen/codeplug-studio/issues/769) slice 5b). MR channel encode rejects AM airband (108–137 MHz) in MR slots. `DigitalContact*`, boot/BK images, crypto, roaming, AnalogBook, and broadcast FM are **not** in the v1 Write set. Use Anytone CSV egress for remaining unmodelled banks — see [am-air.md](../../../export-formats/anytone/am-air.md). Export **Web Serial** shows a **What Write updates** coverage table. See [memory-layout.md](memory-layout.md).

**Operator note:** perform a **fresh Read** after CPS recovery before Write — do not Write from a stale hydration export. Web Serial Write is available on production deploys ([#800](https://github.com/pskillen/codeplug-studio/issues/800)); Anytone CSV file egress remains available for unmodelled banks.

**Hardware note:** Chinese UI + startup password after Write were attributed to LocalInfo replay on upload ([#753](https://github.com/pskillen/codeplug-studio/issues/753)) and, in an earlier incident, illegal channel BCD ([#717](https://github.com/pskillen/codeplug-studio/issues/717)).

## Ground truth (cite; do not copy)

anytone-cps and qdmr are **GPL**. Extract **facts** only — do **not** paste GPL sources into Studio.

| Source                                                                                      | Role                                                            |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| anytone-cps `D890_MAP` in `anytone_memory.h`                                                | Sparse region bases, strides, lengths                           |
| anytone-cps `SerialDevice` (`device.h` / `device.cpp`)                                      | Baud, PROGRAM→QX, R/W frames, checksum, skip-write, ident bytes |
| qdmr `anytone_interface`                                                                    | Handshake / R/W framing cross-check (no D890 region map)        |
| [`profiles.ts`](../../../../src/core/import-export/formats/anytone/profiles.ts)             | Caps + `AT_D890UV_POWER_LADDER` (CSV path)                      |
| [#357](https://github.com/pskillen/codeplug-studio/issues/357)                              | Transmit Power confirmation (CSV)                               |
| External CPS wire verifier ([#480](https://github.com/pskillen/codeplug-studio/issues/480)) | Wire-file limit checks                                          |

## Studio module

`src/integrations/radio-io/radios/at-d890uv/` — sparse selective-ranges adapter ([#649](https://github.com/pskillen/codeplug-studio/issues/649)). Kit codec ([#646](https://github.com/pskillen/codeplug-studio/issues/646)). See [protocol-kit architecture](../../../../features/radio-read-write/protocol-kit-architecture.md).

## Related

- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- Epic [#645](https://github.com/pskillen/codeplug-studio/issues/645) · memory RE [#647](https://github.com/pskillen/codeplug-studio/issues/647) · adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649) · kit codec [#646](https://github.com/pskillen/codeplug-studio/issues/646)
- D878UVII docs [#648](https://github.com/pskillen/codeplug-studio/issues/648) · adapter [#650](https://github.com/pskillen/codeplug-studio/issues/650)
- Anytone CSV extract [#621](https://github.com/pskillen/codeplug-studio/issues/621) · earlier epic [#594](https://github.com/pskillen/codeplug-studio/issues/594)
- Code ↔ docs mop-up: [#402](https://github.com/pskillen/codeplug-studio/issues/402)
