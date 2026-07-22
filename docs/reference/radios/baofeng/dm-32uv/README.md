# Baofeng DM-32UV

Handheld DMR + analogue dual-band radio (DM-32 family). Studio targets it via DM32 CPS CSV and NeonPlug `.neonplug`.

| | |
| --- | --- |
| **Manufacturer** | Baofeng |
| **Model** | DM-32UV |
| **Aliases** | DP570UV (NeonPlug / wire model labels) |
| **Max RF** | High / Middle / Low (see [power.md](power.md)) |

## Studio profile ids

| Adapter | `profileId` | Notes |
| --- | --- | --- |
| DM32 CPS CSV | `dm32-baofeng-dm32uv` | Stock CPS ladders and caps |
| NeonPlug | `neonplug-dm32uv` | Binary / ZIP interchange; numeric caps kept in sync with DM32 profile |

## Documentation map

| Doc | Contents |
| --- | --- |
| [limits.md](limits.md) | Channels, zones, scan / RX / contacts / TGs, name lengths |
| [capabilities.md](capabilities.md) | Modes, organisation traits |
| [power.md](power.md) | High / Middle / Low + squelch ladder |

## Adapter wire

- [DM32 export-format](../../../export-formats/dm32/README.md) — CPS CSV columns / verification
- [NeonPlug export-format](../../../export-formats/neonplug/README.md) — `.neonplug` / merge / projections

## Ground truth

| Source | Role |
| --- | --- |
| NeonPlug [`src/radios/dm32uv/`](https://github.com/infamy/NeonPlug/tree/main/src/radios/dm32uv) (`LIMITS`, models) | Caps, channel/zone/scan shapes |
| Baofeng DM-32UV stock CPS | CSV column layouts (adapter docs) |

## Related

- Parked CPS CSV fidelity: [cps-csv-gaps.md](../../../../features/import-export/dm32/cps-csv-gaps.md)
- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · extract [#621](https://github.com/pskillen/codeplug-studio/issues/621)
