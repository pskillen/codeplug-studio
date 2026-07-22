# RT95 VOX — capabilities

## RF / modes

| Capability          | Support                                                        |
| ------------------- | -------------------------------------------------------------- |
| Max RF power        | ~25 W                                                          |
| Analogue FM (NFM)   | Yes                                                            |
| AM                  | Yes                                                            |
| DMR / other digital | No — non-FM/AM internal modes skipped on export (with warning) |

## Organisation traits

Flat memory list only:

- **No** zones, scan lists, contacts, talk groups, or RX group lists on the radio
- Radio characteristics marks those rows as not used (`getProfileExportLimits`)

Studio Build → Channels uses the shared **flat-memory** Channels page for this radio’s profile.

## Related

- [limits.md](limits.md) · [power.md](power.md)
