# RT84 (RadioFoundry) — capabilities

| Capability  | Support                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| DMR digital | Yes                                                                                                                        |
| Analogue FM | Yes                                                                                                                        |
| M17         | Yes. The channel stores a CAN and a destination; the radio sends the CAN on air and filters on it (firmware M6 and later). |

### Frequency ranges (Studio eligibility)

| Band (MHz) | Modes        | TX  |
| ---------- | ------------ | --- |
| 136–174    | FM, DMR, M17 | Yes |
| 400–480    | FM, DMR, M17 | Yes |

Source: [limits.md](limits.md).

Satellite keps: over the debug link when the build has satellite tracking on; see [RadioFoundry satellite keps](../../radiofoundry/satellite-keps.md).
