# DM32 — Zones.csv

| Column            | Internal           | Notes                                                                                                                                           |
| ----------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `No.`             | _(export only)_    | Sequential on export; excluded from bidirectional mapping diff                                                                                  |
| `Zone Name`       | `Zone.name`        | Shortened when export **Shorten long names** is on and name exceeds profile `nameLimit`                                                         |
| `Channel Members` | `memberChannelIds` | Pipe-separated channel **wire** names; **no** trailing `\|` (unlike `Scan.csv`; [#487](https://github.com/pskillen/codeplug-studio/issues/487)) |

Zone export uses `expandZoneMemberWireNames` with `expandModes: false` and DM32 talk-group expansion guards so members match flat `Channels.csv` names.
