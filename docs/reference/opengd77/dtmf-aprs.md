# OpenGD77 — DTMF.csv and APRS.csv

Generic column reference for deferred OpenGD77 CPS files. **Feature availability varies by radio** — see [radio profiles](radios/README.md).

**App status:** Both files are **skipped on import**. Export includes **header-only** bodies inside the ZIP bundle. See [import/export outstanding](../../features/outstanding.md).

## DTMF.csv

Tone sequences for analogue repeaters. Referenced independently of channel rows.

| Vendor header | Semantics | App status |
| --- | --- | --- |
| `Contact Name` | DTMF contact label | Not modelled |
| `Code` | Tone sequence | Not modelled |

### Radio availability

| Profile | DTMF.csv |
| --- | --- |
| [Baofeng 1701](radios/baofeng-1701.md) | Supported in CPS; not modelled in app |
| Other OpenGD77 targets | Assumed supported where CPS exports file — TBD |

## APRS.csv

Standalone APRS configuration records. Channels reference a config by name via `Channels.APRS`.

| Vendor header | Semantics | App status |
| --- | --- | --- |
| `APRS config Name` | Config identifier; FK from `Channels.APRS` | Name only on channel |
| `SSID` | APRS SSID | Not modelled |
| `Via1` | Via path 1 | Not modelled |
| `Via1 SSID` | Via 1 SSID | Not modelled |
| `Via2` | Via path 2 | Not modelled |
| `Via2 SSID` | Via 2 SSID | Not modelled |
| `Icon table` | Icon table selector | Not modelled |
| `Icon` | Icon code | Not modelled |
| `Comment text` | Beacon comment | Not modelled |
| `Ambiguity` | Position ambiguity | Not modelled |
| `Use position` | Use stored position | Not modelled |
| `Latitude` | Config latitude | Not modelled |
| `Longitude` | Config longitude | Not modelled |
| `TX Frequency` | APRS TX frequency | Not modelled |
| `Transmit QSY` | QSY behaviour | Not modelled |
| `Baud rate setting` | APRS baud rate | Not modelled |

Canonical header order in [`columns.ts`](../../../src/core/import-export/formats/opengd77/columns.ts) (`APRS_HEADERS`).

### Bidirectional mapping today

| Field | Tier |
| --- | --- |
| `Channels.APRS` → `Channel.aprsConfigName` | String pass-through on channel row |
| `APRS.csv` body rows | **Lost** — export writes headers only |

### Radio availability

| Profile | APRS.csv | Notes |
| --- | --- | --- |
| [Baofeng 1701](radios/baofeng-1701.md) | Supported in CPS | Config body not modelled in app |
| RD-5R / DM-5R | Hotspot limitations | USB while TX — operational, not CSV |
| GD-77S | Headless | APRS operation differs — wire format TBD |

## Future modelling

When APRS/DTMF are modelled, add first-class entities or profile-scoped config stores and extend import/export adapters. Column semantics in this doc remain the wire reference.

## Related

- [Channels — APRS column](channels.md)
- [OpenGD77 hub](README.md)
- [Import / export outstanding](../../features/outstanding.md)
