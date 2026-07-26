# UV-21Pro V2 — capabilities

## RF / modes

| Capability               | Support                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| Max RF power             | 5 W                                                                 |
| Analogue FM (NFM / wide) | Yes                                                                 |
| AM                       | Yes (airband-style use)                                             |
| DMR / other digital      | No — digital-only library channels skipped on export (with warning) |

### Frequency ranges (Studio eligibility)

Inclusive MHz bands used when filtering build lists and export ([#612](https://github.com/pskillen/codeplug-studio/issues/612)). See [channel-eligibility.md](../../../../features/builds/channel-eligibility.md).

| Band (MHz)     | Modes | TX           |
| -------------- | ----- | ------------ |
| 108–135.999999 | AM    | Yes          |
| 136–174        | FM    | Yes          |
| 220–260        | FM    | Yes          |
| 350–390        | FM    | Receive-only |
| 400–479.999999 | FM    | Yes          |
| 480–520        | FM    | Receive-only |

Source: CHIRP `UV21ProV2.VALID_BANDS`.

## Organisation traits

Flat memory list only:

- **No** zones, scan lists, contacts, talk groups, or RX group lists on the radio
- Per-channel scan flag via library `scanInclusion` / build overrides (CHIRP `Skip`)

Studio Build → Channels uses the shared **flat-memory** Channels page for this radio’s profile.

## Related

- [limits.md](limits.md) · [power.md](power.md)
- Scan inclusion (tier 2): [scan-inclusion.md](../../../scan-inclusion.md)
