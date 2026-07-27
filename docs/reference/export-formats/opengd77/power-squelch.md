# OpenGD77 — Power and squelch wire mapping

OpenGD77 `Channels.csv` columns `Power` and `Squelch` map to internal percent fields at the adapter boundary. Implementation: [`channelWire.ts`](../../../../src/core/import-export/formats/opengd77/channelWire.ts) (export); import parse is **planned** ([#522](https://github.com/pskillen/codeplug-studio/issues/522)).

Internal semantics (vendor-neutral): see [data model — Channel](../../../features/data-model/README.md#channel).

## Power (`Power` column)

| OpenGD77 wire | Internal `power`        | Notes                          |
| ------------- | ----------------------- | ------------------------------ |
| `Master`      | `null` (radio default)  | Export when library unset      |
| `P1`…`P9`     | Profile ladder percent  | See radio profile tables below |
| empty         | `null` (import, target) | Planned import behaviour       |

Export picks the **nearest ladder step** for non-exact percent values via `opengd77PercentToWire` in [`profiles.ts`](../../../../src/core/import-export/formats/opengd77/profiles.ts).

**Profile-specific ladders** (watts ↔ percent):

| Profile           | Radio home                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `opengd77-1701`   | [Baofeng DM-1701 — power.md](../../radios/baofeng/dm-1701/power.md)                                                                    |
| `opengd77-md9600` | [TYT MD-9600 — power.md](../../radios/tyt/md-9600/power.md) (validated [#441](https://github.com/pskillen/codeplug-studio/issues/441)) |

User-power menu string (`+W-` / `-W+`) is **not modelled** in Studio; see [#440](https://github.com/pskillen/codeplug-studio/issues/440) after CPS elicitation ([#403](https://github.com/pskillen/codeplug-studio/issues/403)).

## Squelch (`Squelch` column)

Mode-dependent wire rules — see [channels.md](channels.md#mode-dependent-columns).

| OpenGD77 wire (export, analogue) | Internal `squelch` | Notes                                    |
| -------------------------------- | ------------------ | ---------------------------------------- |
| `Disabled`                       | `null` or `0`      | Radio default / unset                    |
| `N%` (e.g. `75%`)                | `N` (0–100)        | Percent level                            |
| _(empty)_                        | —                  | Digital channels: always empty on export |

`Master`, `Open`, and `Closed` appear in G4EML / user-guide prose but are **not confirmed** in Studio export today — see [#439](https://github.com/pskillen/codeplug-studio/issues/439) after elicitation ([#403](https://github.com/pskillen/codeplug-studio/issues/403)).

## Related

- [Channels.csv column reference](channels.md)
- [OpenGD77 reference hub](README.md)
- [Studio profiles](profiles.md)
