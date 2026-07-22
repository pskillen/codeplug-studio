# DM32 export projections

Operator guide to **export-time channel projections** on Baofeng DM-32UV builds. Behaviour matches the Anytone sibling where the formats share m×n expansion — see [anytone/export-projections.md](../anytone/export-projections.md).

**Tracking:** [#110](https://github.com/pskillen/codeplug-studio/issues/110) · [#140](https://github.com/pskillen/codeplug-studio/issues/140)

---

## Lean vs expanded export

| Mode         | When                                         | Channels.csv                                                                                                                    |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Lean**     | **m×n channel expansion** off (export panel) | One row per library channel; TX Contact + RX Group List as programmed                                                           |
| **Expanded** | m×n expansion **on** (default)               | One row per **talk group** on each digital channel's RX group list (skipped when TX contact + RGL both set, or list name `ALL`) |

---

## Scratch channels

When m×n expansion is on, you can also export **scratch channels** (default **on**):

- **One scratch memory per expanded repeater** (per source library channel), not per talk group and not per zone.
- Faithful copy of the parent channel (frequencies, mode, power, contact, RX group list) with **Scratch** in the wire name.
- Scratch is **not** emitted when expansion is off.

**Toggle:** Build → Export → **Channels** → **Scratch channels** (`exportSettings.exportScratchChannels`) — only enabled when expansion is on.

Legacy `ZoneGroupingLayout.exportScratchChannel` (older builds / YAML) is **ignored** on export; use the Export panel toggle instead.

---

## Zones

Each zone member library channel id **fans out** to all projected wire names (expanded TG rows + scratch when enabled) in `Zones.csv`.

---

## Related

- [export-mapping.md](export-mapping.md)
- [multi-talkgroup.md](../../../reference/export-formats/dm32/multi-talkgroup.md)
- [zone-grouping.md](../../builds/zone-grouping.md)
