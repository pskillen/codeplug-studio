# DM-32UV (RadioFoundry) — capabilities

## RF / modes

| Capability  | Support                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| DMR digital | Yes                                                                                                                        |
| Analogue FM | Yes                                                                                                                        |
| M17         | Yes. The channel stores a CAN and a destination; the radio sends the CAN on air and filters on it (firmware M6 and later). |

Studio writes FM, conventional DMR and M17 to this radio. Other modes are not offered until Studio can write them.

### Frequency ranges (Studio eligibility)

Inclusive MHz bands used when filtering build lists and export. See [channel-eligibility.md](../../../../features/builds/channel-eligibility.md).

| Band (MHz) | Modes        | TX  |
| ---------- | ------------ | --- |
| 136–174    | FM, DMR, M17 | Yes |
| 400–480    | FM, DMR, M17 | Yes |

Source: the board bands in [limits.md](limits.md) (`DM32UV_RADIOFOUNDRY_BOARD.BANDS_HZ`); the row is in `src/core/radio-targets/rfCapabilities.ts` and a test pins it to them.

Unlike the stock DM-32UV, there is no receive-only 87–136 MHz row: nothing in RadioFoundry says it keeps the broadcast and air band receive, so Studio does not claim it.

Satellite keps: over the debug link when the build has satellite tracking on; see [RadioFoundry satellite keps](../../radiofoundry/satellite-keps.md).

## Related

- [limits.md](limits.md) · [RadioFoundry firmware limits](../../radiofoundry/limits.md)
