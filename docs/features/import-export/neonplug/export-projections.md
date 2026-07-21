# NeonPlug export projections

Operator guide to **export-time channel projections** on Baofeng DM-32UV (NeonPlug) builds. Product semantics match DM32 CPS CSV m×n expansion — see [dm32/export-projections.md](../dm32/export-projections.md) — but NeonPlug emits extra `channels[]` objects and zone/scan **channel numbers**, not CSV wire names.

**Tracking:** [#553](https://github.com/pskillen/codeplug-studio/issues/553)

---

## Lean vs expanded export

| Mode         | When                                         | NeonPlug `channels[]`                                                                                                              |
| ------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Lean**     | **m×n channel expansion** off (export panel) | One object per library channel; `contactId` + `rxGroupListId` as programmed                                                        |
| **Expanded** | m×n expansion **on** (default)               | One object per **talk group** on each digital channel's RX group list (skipped when TX contact + RGL both set, or list name `ALL`) |

Expanded talk-group rows set `contactId` to the member and clear `rxGroupListId` (`0`).

---

## Scratch channels

When m×n expansion is on, you can also export **scratch channels** (default **on**):

- **One scratch memory per expanded repeater** (per source library channel), not per talk group and not per zone.
- Faithful copy of the parent channel (frequencies, mode, power, contact, RX group list) with **Scratch** in the channel name.
- Scratch is **not** emitted when expansion is off.

**Toggle:** Build → Export → **Channel expansion** → **Scratch channels** (`exportSettings.exportScratchChannels`) — only enabled when expansion is on.

---

## Zones and scan lists

Each zone (or zone-derived scan list) member library channel id **fans out** to all projected channel **numbers** (expanded TG rows + scratch when enabled), then truncates to the NeonPlug profile member caps (`zoneMembers` / `scanListMembers`).

All expanded rows for a source channel inherit the same `scanListId`.

When **Export zone-derived scan lists** is on:

- With a populated zoneGrouping layout, only zones with `exportScanList: true` emit lists.
- With an **empty or missing** layout, every assembled zone is treated as `exportScanList: true` (same spirit as zone assemble’s library fallback) — [#562](https://github.com/pskillen/codeplug-studio/issues/562).
- Each derived list gets a synthetic **`{zone} Scan`** carrier channel (default 145.500 MHz, or layout `scanCarrierFrequencyHz`), prepended as the first zone member, with `designatedTxChannel` on the scan list set to that carrier number.

When no zone-derived scan lists are produced, DM32UV export still emits one default list (`Scan list 1`) with the first exported channel as a member so NeonPlug’s write filter retains it — see [scan-lists.md](../../../reference/neonplug/scan-lists.md) (#564).

---

## Caps and merge

- Expanded + scratch objects count against `maxChannels` (4000 for `neonplug-dm32uv`); excess rows are truncated with a warning.
- Merge-into-base ([#551](https://github.com/pskillen/codeplug-studio/issues/551)) still **replaces** donor `channels[]` (and zone/scan membership) with the Studio projection wholesale — expanded exports overwrite donor channel memories the same way lean exports do.

---

## Related

- [neonplug feature hub](README.md)
- [multi-talkgroup-expansion.md](../../../reference/multi-talkgroup-expansion.md)
- [channels.md](../../../reference/neonplug/channels.md) · [zones.md](../../../reference/neonplug/zones.md) · [scan-lists.md](../../../reference/neonplug/scan-lists.md)
- Sibling: [dm32/export-projections.md](../dm32/export-projections.md)
