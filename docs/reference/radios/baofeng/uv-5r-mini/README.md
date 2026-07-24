# Baofeng UV-5R Mini

Handheld analogue FM/AM radio (UV-17Pro lineage). Studio targets it via CHIRP CSV, NeonPlug `.neonplug`, and **Web Serial** direct-write.

|                  |                                    |
| ---------------- | ---------------------------------- |
| **Manufacturer** | Baofeng                            |
| **Model**        | UV-5R Mini                         |
| **Aliases**      | UV5R-Mini (NeonPlug / wire labels) |
| **Max RF**       | 5 W                                |

> **CHIRP CSV / `.neonplug` wire ≠ binary clone image.** File interchange lives under [export-formats/chirp](../../../export-formats/chirp/README.md) and [export-formats/neonplug](../../../export-formats/neonplug/README.md). PROGRAM+R/W memory maps, channel records, and handshake framing live in the binary docs below.

**Product hub:** [radio-read-write](../../../../features/radio-read-write/README.md) · **Tracking:** epic [#633](https://github.com/pskillen/codeplug-studio/issues/633) · memory RE [#627](https://github.com/pskillen/codeplug-studio/issues/627) · adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617)

## Studio profile ids

| Adapter    | `profileId`         | Notes                                                                                          |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| Web Serial | `radio-io-uv5r-mini` | Direct radio egress; PROGRAM+R/W ([#617](https://github.com/pskillen/codeplug-studio/issues/617), [#655](https://github.com/pskillen/codeplug-studio/issues/655), [#675](https://github.com/pskillen/codeplug-studio/issues/675)) |
| CHIRP CSV  | `chirp-uv5r`        | Generic CSV watt strings                                                                       |
| NeonPlug   | `neonplug-uv5rmini` | Binary / ZIP interchange                                                                       |

## Documentation map

| Doc                                    | Contents                                                             |
| -------------------------------------- | -------------------------------------------------------------------- |
| [limits.md](limits.md)                 | Memory slots, name length                                            |
| [capabilities.md](capabilities.md)     | Modes, organisation traits, RF summary; Web Serial scan-bit gap      |
| [power.md](power.md)                   | High / Low ladder (internal %)                                       |
| [memory-layout.md](memory-layout.md)   | Multi-region image map, packed offsets, FW overlay at `0x1EF0`       |
| [channel-record.md](channel-record.md) | 32-byte channel layout + enums; duplex-off / TX inhibit gap          |
| [settings.md](settings.md)             | VFO / settings / ANI / PTT; Studio full-image retain path            |
| [protocol.md](protocol.md)             | Ident, magics, R/W frames, XOR crypt, baud disagreement              |
| [fixtures.md](fixtures.md)             | How to capture dumps for tests without committing personal codeplugs |

## Adapter wire (files)

- [CHIRP export-format](../../../export-formats/chirp/README.md) — CSV columns / verification (**not** binary offsets)
- [NeonPlug export-format](../../../export-formats/neonplug/README.md) — `.neonplug` / merge / settings bag (**not** clone image)

## Direct read/write (binary)

PROGRAM+R/W clone protocol for Web Serial (**shipped**). See the binary docs in the map above. Known Write gaps: channel-span clear + TX inhibit ([#695](https://github.com/pskillen/codeplug-studio/issues/695)), scan bit ([#696](https://github.com/pskillen/codeplug-studio/issues/696)).

## Ground truth (cite; do not copy)

CHIRP is **GPL**. Extract **facts** only — do **not** paste GPL sources into Studio. NeonPlug is MIT — cite framing / channel map.

| Source                                                                                                                  | Role                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CHIRP `UV5RMini` in [`baofeng_uv17Pro.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/baofeng_uv17Pro.py) | Caps, R/W protocol, crypt, memory regions                                  |
| NeonPlug [`src/radios/uv5rmini/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/uv5rmini)                     | Browser framing (`baofengProtocol.ts`, `serialConnection.ts`, channel map) |

## Attribution

Protocol lineage credit: `/attributions` entries `chirp` and `neonplug` ([#597](https://github.com/pskillen/codeplug-studio/issues/597)). `RadioDescriptor.attributionIds` includes both.

## Studio module

`src/integrations/radio-io/radios/uv5r-mini/` — handshake, layout, encode/decode, `radio-clone` hydration, full-image Write ([#617](https://github.com/pskillen/codeplug-studio/issues/617)). Registry: `src/integrations/radio-io/registry.ts`. Checklist: [adding-a-radio-adapter.md](../../../../features/radio-read-write/adding-a-radio-adapter.md).

**Manual verify (not CI):** real UV-5R Mini over Web Serial (Studio primary baud **115200** with NeonPlug **38400** fallback).

## Related

- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- Epic [#633](https://github.com/pskillen/codeplug-studio/issues/633) · memory RE [#627](https://github.com/pskillen/codeplug-studio/issues/627) · adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617)
