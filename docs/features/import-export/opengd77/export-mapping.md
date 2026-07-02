# OpenGD77 export mapping

Tier-1 summary of how `assemble(build, library)` projection maps to OpenGD77 CPS CSV files. Wire column detail lives in [docs/reference/opengd77/](../../../reference/opengd77/README.md).

**Tracking:** [#88](https://github.com/pskillen/codeplug-studio/issues/88) · Epic [#36](https://github.com/pskillen/codeplug-studio/issues/36)

**Source:** `src/core/import-export/formats/opengd77/serialise.ts`

## Input

Export adapters read `AssembledBuild` from [`assemble`](../../../services/assemble.ts) — not raw IndexedDB rows.

| Projection field | CPS source |
| --- | --- |
| `channels[].wireName` | `Channels.csv` name column |
| `channels[].entity` | Frequency, mode profile, power, location fields |
| `zones[].wireName` | `Zones.csv` zone name |
| `zones[].memberChannelIds` | Zone member columns (resolved to channel wire names) |
| `talkGroups` / contacts | `Contacts.csv` Group / Private rows |
| `rxGroupLists` | `TG_Lists.csv` |

## Output files

| File | Content |
| --- | --- |
| `Channels.csv` | Selected channels with build wire names |
| `Zones.csv` | Zone grouping from build layout |
| `Contacts.csv` | Talk groups + digital/analog contacts |
| `TG_Lists.csv` | RX group lists |
| `DTMF.csv` | Header only (not modelled) |
| `APRS.csv` | Header only (not modelled) |

## Profile limits

Cardinality and name-length warnings are collected in `warnings.ts` using the active radio profile (`opengd77-1701`, `opengd77-md9600`). See [profiles.ts](../../../../src/core/import-export/formats/opengd77/profiles.ts).

## Related

- [cps-services.md](../cps-services.md)
- [opengd77 README](README.md)
