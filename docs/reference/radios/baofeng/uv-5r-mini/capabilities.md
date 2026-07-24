# UV-5R Mini — capabilities

## RF / modes

| Capability               | Support                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| Max RF power             | 5 W                                                                 |
| Analogue FM (NFM / wide) | Yes                                                                 |
| AM                       | Yes (airband-style use)                                             |
| DMR / other digital      | No — digital-only library channels skipped on export (with warning) |

## Organisation traits

Flat memory list only:

- **No** zones, scan lists, contacts, talk groups, or RX group lists on the radio
- Per-channel scan flag via library `scanInclusion` / build overrides (CHIRP `Skip`, NeonPlug file `scanAdd`)

Studio Build → Channels uses the shared **flat-memory** Channels page for this radio’s profiles.

### Web Serial Write gap — scan bit

Binary Web Serial Write does **not** yet map `scanInclusion` to channel record byte `15` bit 2. CHIRP CSV and NeonPlug **file** egress still honour the flag. Tracked by [#696](https://github.com/pskillen/codeplug-studio/issues/696).

## Related

- [limits.md](limits.md) · [power.md](power.md)
- Scan inclusion (tier 2): [scan-inclusion.md](../../../scan-inclusion.md)
