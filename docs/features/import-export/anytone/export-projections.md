# Anytone export projections

Operator guide to **export-time channel projections** on Anytone AT-D890UV builds. Terminology matches [DESIGN.md — Glossary](../../../DESIGN.md#glossary).

**Tracking:** [#305](https://github.com/pskillen/codeplug-studio/issues/305) · [#325](https://github.com/pskillen/codeplug-studio/issues/325)

---

## Lean vs expanded export

| Mode | When | Channel.CSV |
| --- | --- | --- |
| **Lean** | **m×n channel expansion** off (export panel) | One row per library channel; `Receive Group List` and `Contact/Talk Group` name FKs as programmed |
| **Expanded** | m×n expansion **on** (default for new builds) | One row per **talk group** on each digital channel's RX group list |

Library data stays the same — projections are applied only when you export.

---

## m×n channel expansion

For each **digital library channel** that has an **RX group list** with talk-group members:

1. Studio emits **one memory per talk group** on that list.
2. Each expanded row sets **Contact/Talk Group** to that member and clears **Receive Group List** (`None`).
3. **Slot** comes from the member's slot override on the RX list when set; otherwise the channel's DMR timeslot.
4. Wire names follow the same multi-talkgroup naming rules as other formats (default: callsign + talk-group abbrev).

Across a build, total expanded rows ≈ **sum of RX-list sizes** for all expanded channels (not a single cartesian grid unless you model many repeater channels separately in the library).

**Toggle:** Build → Export → **m×n channel expansion** (`exportSettings.expandRxGroupLists`).

---

## Scratch channels

When m×n expansion is on, you can also export **scratch channels** (default **on**):

- **One scratch memory per expanded repeater** (per source library channel), not per talk group and not per zone.
- Faithful copy of the parent channel's frequencies, mode, power, contact, and RX group list — with **Scratch** in the wire name so you can retune in the field without touching programmed TG rows.
- Scratch is **not** emitted when expansion is off (the lean parent row is already editable).

**Toggle:** Build → Export → **Scratch channels** (`exportSettings.exportScratchChannels`) — only enabled when expansion is on.

---

## Zones

Zones still reference **library channel ids** internally. On export:

- Each zone member id **fans out** to **all projected wire names** for that channel (every expanded TG row + scratch when enabled).
- `DMRZone.CSV` member columns list those names (and matching RX/TX MHz columns repeated per projection).

Airband channels in mixed zones continue to partition to `AMZone.CSV` — unchanged.

---

## Scan lists

### Library scan lists

`ScanList.CSV` members use the same fan-out: each logical `memberChannelId` becomes **all** exported wire names for that channel.

### Zone-derived scan lists

When **Export zone-derived scan lists** is on and a zone is marked **Export as scan list**:

- The derived scan list still uses **logical** channel ids for membership.
- Exported `Scan List Channel Member` columns list **expanded** wire names (plus the zone scan carrier when synthesised).
- Carrier channel behaviour is unchanged — see [scan-lists.md](../../reference/anytone/scan-lists.md).

---

## RX group list file

`DMRReceiveGroupCallList.CSV` is still exported from the **library** RX group lists. Expanded TG rows do **not** reference those lists on the wire (`Receive Group List` = `None`). Scratch rows may still reference the parent list when the library channel does.

---

## Wire preview

The build **Channels** wire preview uses the **same expansion path** as export. Fan-out rows show talk-group context (name, ID, slot) or a **Scratch channel** marker under the display name.

---

## DM32 comparison

Baofeng DM32 export uses similar m×n expansion mechanics but differs in defaults, scratch serialisation, and zone-level legacy flags. See epic [#37](https://github.com/pskillen/codeplug-studio/issues/37) gap-analysis ticket for alignment work.

---

## Related

- [anytone/README.md](README.md) — feature hub
- [multi-talkgroup-expansion.md](../../reference/multi-talkgroup-expansion.md) — domain rules
- [wire-preview.md](../../builds/wire-preview.md)
