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

| Adapter     | `profileId`         | Notes                                                               |
| ----------- | ------------------- | ------------------------------------------------------------------- |
| Anytone CSV | `anytone-at-d890uv` | Epic [#228](https://github.com/pskillen/codeplug-studio/issues/228) |

## Documentation map

| Doc                                    | Contents                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| [limits.md](limits.md)                 | Channels, zone/scan/RGL members, names, APRS slots, VFO rows (file-adapter truth)    |
| [capabilities.md](capabilities.md)     | Feature / bank export availability                                                   |
| [power.md](power.md)                   | Low / Mid / High / Turbo ladder                                                      |
| [protocol.md](protocol.md)             | Baud 921600, PROGRAM→QX, ident, ASCII R/W + u32 BE, checksum, END, safe-skip address |
| [memory-layout.md](memory-layout.md)   | `D890_MAP` region table (first-adapter subset) + address formulas                    |
| [channel-record.md](channel-record.md) | 0x80 combined channel (0x40+0x40); address formula; ChannelSet bitmap                |
| [zone-record.md](zone-record.md)       | ZoneSet / ZonesName / ZoneChannels / A/B indices                                     |
| [fixtures.md](fixtures.md)             | How to capture dumps for tests without committing personal codeplugs                 |

## Adapter wire (files)

- [Anytone export-format](../../../export-formats/anytone/README.md) — columns / traits (**not** binary offsets)
- Feature hub: [import-export/anytone](../../../../features/import-export/anytone/README.md)

## Direct read/write (binary)

Anytone DMR PROGRAM→QX session at **921600** baud with **u32 BE** addresses and sparse multi‑MB regions. See the binary docs in the map above. Kit codec for this family is sibling [#646](https://github.com/pskillen/codeplug-studio/issues/646) — out of scope for this docs ticket.

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

## Planned Studio module

`src/integrations/radio-io/radios/at-d890uv/` — handshake, sparse layout, encode (see [protocol-kit architecture](../../../../features/radio-read-write/protocol-kit-architecture.md)). This ticket ships **docs only**.

## Related

- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- Epic [#645](https://github.com/pskillen/codeplug-studio/issues/645) · memory RE [#647](https://github.com/pskillen/codeplug-studio/issues/647) · adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649) · kit codec [#646](https://github.com/pskillen/codeplug-studio/issues/646)
- D878UVII docs [#648](https://github.com/pskillen/codeplug-studio/issues/648) · adapter [#650](https://github.com/pskillen/codeplug-studio/issues/650)
- Anytone CSV extract [#621](https://github.com/pskillen/codeplug-studio/issues/621) · earlier epic [#594](https://github.com/pskillen/codeplug-studio/issues/594)
- Code ↔ docs mop-up: [#402](https://github.com/pskillen/codeplug-studio/issues/402)
