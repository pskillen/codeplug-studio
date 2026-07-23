# Baofeng UV-5R Mini

Handheld analogue FM/AM radio (UV-17Pro lineage). Studio targets it via CHIRP CSV, NeonPlug `.neonplug`, and (planned) Web Serial direct-write.

|                  |                                    |
| ---------------- | ---------------------------------- |
| **Manufacturer** | Baofeng                            |
| **Model**        | UV-5R Mini                         |
| **Aliases**      | UV5R-Mini (NeonPlug / wire labels) |
| **Max RF**       | 5 W                                |

> **CHIRP CSV / `.neonplug` wire ≠ binary clone image.** File interchange lives under [export-formats/chirp](../../../export-formats/chirp/README.md) and [export-formats/neonplug](../../../export-formats/neonplug/README.md). PROGRAM+R/W memory maps, channel records, and handshake framing live in the binary docs below.

**Product hub:** [radio-read-write](../../../../features/radio-read-write/README.md) · **Tracking:** [#627](https://github.com/pskillen/codeplug-studio/issues/627) (blocks adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617); parent [#594](https://github.com/pskillen/codeplug-studio/issues/594))

## Studio profile ids

| Adapter   | `profileId`         | Notes                                                    |
| --------- | ------------------- | -------------------------------------------------------- |
| CHIRP CSV | `chirp-uv5r`        | Generic CSV watt strings                                 |
| NeonPlug  | `neonplug-uv5rmini` | Binary / ZIP interchange; optional Web Serial path later |

## Documentation map

| Doc                                    | Contents                                                             |
| -------------------------------------- | -------------------------------------------------------------------- |
| [limits.md](limits.md)                 | Memory slots, name length                                            |
| [capabilities.md](capabilities.md)     | Modes, organisation traits, RF summary                               |
| [power.md](power.md)                   | High / Low ladder (internal %)                                       |
| [memory-layout.md](memory-layout.md)   | Multi-region image map, packed offsets, not classic S/X              |
| [channel-record.md](channel-record.md) | 32-byte channel layout + enums                                       |
| [settings.md](settings.md)             | VFO / settings / ANI / PTT regions; upload-scope notes               |
| [protocol.md](protocol.md)             | Ident, magics, R/W frames, XOR crypt, baud disagreement              |
| [fixtures.md](fixtures.md)             | How to capture dumps for tests without committing personal codeplugs |

## Adapter wire (files)

- [CHIRP export-format](../../../export-formats/chirp/README.md) — CSV columns / verification (**not** binary offsets)
- [NeonPlug export-format](../../../export-formats/neonplug/README.md) — `.neonplug` / merge / settings bag (**not** clone image)

## Direct read/write (binary)

PROGRAM+R/W clone protocol for Web Serial (and optional BLE later). See the binary docs in the map above.

## Ground truth (cite; do not copy)

CHIRP is **GPL**. Extract **facts** only — do **not** paste GPL sources into Studio. NeonPlug is MIT — cite framing / channel map.

| Source                                                                                                                  | Role                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CHIRP `UV5RMini` in [`baofeng_uv17Pro.py`](https://github.com/kk7ds/chirp/blob/master/chirp/drivers/baofeng_uv17Pro.py) | Caps, R/W protocol, crypt, memory regions                                  |
| NeonPlug [`src/radios/uv5rmini/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/uv5rmini)                     | Browser framing (`baofengProtocol.ts`, `serialConnection.ts`, channel map) |

## Attribution

Protocol lineage credit: `/attributions` entries `chirp` and `neonplug` ([#597](https://github.com/pskillen/codeplug-studio/issues/597)). `RadioDescriptor.attributionIds` includes both.

## Studio module

`src/integrations/radio-io/radios/uv5r-mini/` — handshake, layout, encode/decode, `radio-clone` hydration ([#617](https://github.com/pskillen/codeplug-studio/issues/617)). Registry: `src/integrations/radio-io/registry.ts`. Checklist: [adding-a-radio-adapter.md](../../../../features/radio-read-write/adding-a-radio-adapter.md).

**Manual verify (not CI):** real UV-5R Mini over Web Serial at NeonPlug baud **38400** after connect UI [#618](https://github.com/pskillen/codeplug-studio/issues/618) lands.

## Related

- [radio-read-write hub](../../../../features/radio-read-write/README.md)
- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · memory RE [#627](https://github.com/pskillen/codeplug-studio/issues/627) · adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617)
