# RT90 (RadioFoundry) — capabilities

| Capability  | Support                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| DMR digital | Yes                                                                                                                        |
| Analogue FM | Yes                                                                                                                        |
| M17         | Yes. The channel stores a CAN and a destination; the radio sends the CAN on air and filters on it (firmware M6 and later). |

### Frequency ranges

| Band (MHz) | Modes        | TX  |
| ---------- | ------------ | --- |
| 136–174    | FM, DMR, M17 | Yes |
| 400–480    | FM, DMR, M17 | Yes |

Satellite keps: over the debug link when the build has satellite tracking on; see [RadioFoundry satellite keps](../../radiofoundry/satellite-keps.md).

## Board revisions

RT90 stock firmware identifies V5 boards; RadioFoundry also detects V4A/V5. Upstream reports DMR transmit dropout on some V4A/V5 units until transmit is enabled on the radio (Settings → Advanced → Hardware).
