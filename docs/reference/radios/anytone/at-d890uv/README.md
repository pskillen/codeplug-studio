# Anytone AT-D890UV

Handheld multi-mode radio (DMR + analogue + AM air + broadcast FM). Studio targets it via Anytone CPS CSV. Sibling variants (AT-D878UV, AT-D578UV, …) are out of scope for v1.

| | |
| --- | --- |
| **Manufacturer** | Anytone |
| **Model** | AT-D890UV |
| **CPS** | Anytone CPS CSV |

Provisional limits mirror `profiles.ts` (`ANYTONE_PROFILES`); still verify against CPS manual before treating as hard radio caps.

## Studio profile ids

| Adapter | `profileId` | Notes |
| --- | --- | --- |
| Anytone CSV | `anytone-at-d890uv` | Epic [#228](https://github.com/pskillen/codeplug-studio/issues/228) |

## Documentation map

| Doc | Contents |
| --- | --- |
| [limits.md](limits.md) | Channels, zone/scan/RGL members, names, APRS slots, VFO rows |
| [capabilities.md](capabilities.md) | Feature / bank export availability |
| [power.md](power.md) | Low / Mid / High / Turbo ladder |

## Adapter wire

- [Anytone export-format](../../../export-formats/anytone/README.md) — columns / traits
- Feature hub: [import-export/anytone](../../../../features/import-export/anytone/README.md)

## Ground truth

| Source | Role |
| --- | --- |
| [`profiles.ts`](../../../../src/core/import-export/formats/anytone/profiles.ts) | Caps + `AT_D890UV_POWER_LADDER` |
| [#357](https://github.com/pskillen/codeplug-studio/issues/357) | Transmit Power confirmation |
| External CPS wire verifier ([#480](https://github.com/pskillen/codeplug-studio/issues/480)) | Wire-file limit checks |

## Related

- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · extract [#621](https://github.com/pskillen/codeplug-studio/issues/621)
- Code ↔ docs mop-up: [#402](https://github.com/pskillen/codeplug-studio/issues/402)
