# DM32 — Zones.csv

| Column            | Internal           | Notes                                                                           |
| ----------------- | ------------------ | ------------------------------------------------------------------------------- |
| `No.`             | _(export only)_    | Sequential on export; excluded from bidirectional mapping diff                  |
| `Zone Name`       | `Zone.name`        |                                                                                 |
| `Channel Members` | `memberChannelIds` | Pipe-separated channel **wire** names; resolved via expanded name map on import |

Zone export uses `expandZoneMemberWireNames` with `expandModes: false` and DM32 talk-group expansion guards so members match flat `Channels.csv` names.
