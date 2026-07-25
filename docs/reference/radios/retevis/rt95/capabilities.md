# RT95 VOX — capabilities

## RF / modes

| Capability          | Support                                                        |
| ------------------- | -------------------------------------------------------------- |
| Max RF power        | ~25 W                                                          |
| Analogue FM (NFM)   | Yes                                                            |
| AM / airband        | **No** — FM/NFM only (CHIRP `valid_modes`; no AM in channel record) |
| DMR / other digital | No — unsupported modes omitted from export (with warning)        |

## Organisation traits

Flat memory list only:

- **No** zones, scan lists, contacts, talk groups, or RX group lists on the radio
- Radio characteristics marks those rows as not used (`getProfileExportLimits`)

Studio Build → Channels uses the shared **flat-memory** Channels page for this radio’s profile.

## Related

- [limits.md](limits.md) · [power.md](power.md)
