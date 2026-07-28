# RT95 VOX — capabilities

## RF / modes

| Capability          | Support                                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Max RF power        | ~25 W                                                                                                                                                                                          |
| Analogue FM (NFM)   | Yes                                                                                                                                                                                            |
| AM / airband        | **No** — FM/NFM only (CHIRP `valid_modes`; no AM in channel record). Studio assemble/export skips AM library channels with an unsupported-mode warning on both CHIRP CSV and Web Serial paths. |
| DMR / other digital | No — unsupported modes omitted from export (with warning)                                                                                                                                      |

### Frequency ranges (Studio eligibility)

Inclusive MHz bands used when filtering build lists and export ([#612](https://github.com/pskillen/codeplug-studio/issues/612)). Static table uses bandlimit index `0x01` — live bandlimit from Web Serial Read is out of scope for v1. See [channel-eligibility.md](../../../../features/builds/channel-eligibility.md).

| Band (MHz) | Modes | TX  |
| ---------- | ----- | --- |
| 136–174    | FM    | Yes |
| 400–490    | FM    | Yes |

Source: [memory-layout.md](memory-layout.md) bandlimit index `0x01`.

## Organisation traits

Flat memory list only:

- **No** zones, scan lists, contacts, talk groups, or RX group lists on the radio
- Radio characteristics marks those rows as not used (`getProfileExportLimits`)

Studio Build → Channels uses the shared **flat-memory** Channels page for this radio’s profile.

## Related

- [limits.md](limits.md) · [power.md](power.md)
