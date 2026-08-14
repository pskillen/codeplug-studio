# DM-1701 — limits

OpenGD77 / G4EML CPS caps for this hardware. Adapters warn or truncate at the **export boundary** — library CRUD stays unlimited.

**Code:** `src/core/radios/opengd77/limits.ts` (`OPENGD77_FAMILY_LIMITS`); Web Serial `OPENGD77_*` cardinality in `src/integrations/radio-io/radios/opengd77/constants.ts` re-exports from core.

| Constraint           | Value                   | Notes                                                                                                                 |
| -------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Max channels         | **1023**                | `Channel Number` unique integer 1–1023; gaps allowed (G4EML CSV doc)                                                  |
| Max zones            | **68**                  | Forum mod/dev reply — best available; not independently confirmed for DM-1701 specifically                            |
| Max RX group lists   | **76**                  | Same forum source as max zones                                                                                        |
| Max contacts         | **1024**                | Contact bank size; talk groups are `Contacts.csv` rows with ID Type `Group`                                           |
| Max talk groups      | _(shares contact bank)_ | No separate TG table — each TG is a contact row                                                                       |
| Zone members         | **80**                  | `Channel1`…`Channel80` (G4EML CSV doc)                                                                                |
| TG list members      | **32**                  | `Contact1`…`Contact32` (G4EML CSV doc)                                                                                |
| Channel name display | **16** chars            | LCD / CPS font limit                                                                                                  |
| Zone name display    | **16** chars            | Forum mod/dev reply                                                                                                   |
| Contact name display | **16** chars            | Confirmed in forum (Jan 2025 thread)                                                                                  |
| TG name display      | **16** chars            | Same field as contact name (Group rows)                                                                               |
| RX group list name   | **15** chars (binary)   | Serial codec field; CSV UI uses 16 for other names — see `OPENGD77_FAMILY_LIMITS.RX_GROUP_NAME_LEN`                   |
| Satellite keps       | **25** spacecraft       | One `0x64` record per sat (FM + APRS + beacon fields) — [satellite-orbitals.md](../../opengd77/satellite-orbitals.md) |
| Satellite name       | **8** chars             | Binary `SatelliteElement` name; library names stay unlimited                                                          |
| TOT range            | **0–495**, step **15**  | `0` = off (G4EML CPS)                                                                                                 |
| Colour code          | **0–15**                | Digital channels                                                                                                      |
| Append CSV renumber  | Ignores channel numbers | Append mode compacts and renumbers sequentially                                                                       |

## Adapter application

| Adapter                  | Behaviour when over limit                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenGD77 `opengd77-1701` | Export warns on entity counts; zone/TG-list **member** columns truncate; `cps-verify` enforces wire cardinality — see [file-format.md — Wire verification](../../../export-formats/opengd77/file-format.md#wire-verification) |

## Related

- [capabilities.md](capabilities.md) · [power.md](power.md)
- Studio profile: [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts) (`opengd77-1701`)
