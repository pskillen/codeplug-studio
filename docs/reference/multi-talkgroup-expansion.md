# Multi-talkgroup expansion

Domain rules for expanding one **logical digital channel** (with an RX group list) into multiple export rows — one per talk group (or contact) on the wire. Primary consumers: **Baofeng DM32** (default on) and **Anytone AT-D890UV** (optional — lean + native RGL remains valid when off). See [anytone/export-projections.md](../features/import-export/anytone/export-projections.md).

**Not applicable to OpenGD77** — OpenGD77 CPS carries `TG List` and `TG_Lists.csv` natively; lean export (one channel row + list reference) is correct. See [opengd77/multi-talkgroup.md](opengd77/multi-talkgroup.md).

> **Studio note:** Expansion is an **export-time projection** driven by the format build's capability traits and the target wire adapter — not a library-schema flag. Implementation: `src/core/import-export/` (Phase 4+). Internal relationships use UUID `id` refs (`rxGroupListId`, `memberRefs`); wire names stay at the import/export edge only.

**Archive reference:** ported from [codeplug-tool](https://github.com/pskillen/codeplug-tool) multi-TG expansion design.

---

## Library model (source of truth)

Operators model promiscuous RX with existing library fields — no per-channel multi-talkgroup flag:

| Field                                                                     | Role                                                              |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Channel.rxGroupListId` (or per-profile `rxGroupListId` when `multiMode`) | Which RX group list drives expansion                              |
| `RxGroupList.memberRefs`                                                  | Ordered talk groups and/or private contacts to expand (UUID refs) |
| `Channel.contactRef`                                                      | TX contact on lean rows; cleared on expanded rows                 |

RX group list CRUD is how operators manage the talk group set. See [data-model README](../features/data-model/README.md).

---

## When to expand (export)

Enable TG expansion (`ExportOptions.expandRxGroupLists`) when the operator wants **one memory per RX-list member** on export. DM32 defaults **on**; Anytone defaults **on** but lean export (native RGL on each row) is still available when off.

| Condition                                                                | Action                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Digital/DMR row with resolvable `rxGroupListId` and ≥1 expandable member | Emit one row per member                                     |
| Analog or non-DMR row                                                    | Never expand                                                |
| No RGL or zero members after filter                                      | Emit one unchanged row; optional warning                    |
| Combined with multi-mode                                                 | Mode expand first, then TG expand on digital rows → **m×n** |

Export path: `assemble(build, library)` → trait-aware projection → wire serialisation in `src/core/import-export/formats/<format>/`.

### Member filter (`ExportOptions.expandRxGroupListMembers`)

| Value            | Members expanded                                                                       |
| ---------------- | -------------------------------------------------------------------------------------- |
| `all` (default)  | All `memberRefs` (talk groups and private contacts)                                    |
| `talkGroupsOnly` | `EntityRef` with `kind: 'talkGroup'` only; skipped private contacts may emit a warning |

### Expanded row semantics

Each expanded row is one site × one member:

- **Wire name:** composed by `multiTalkGroupExportNameMode` (default `callsign_tg_abbrev`) — see [Wire name modes](#wire-name-modes). Stored on the **format build** as selection `overrides.name` so profile length limits can be reviewed and edited — not recomputed silently each export.
- **Contact / TX ref:** the member (`contactRef` on the expanded row)
- **RX group list:** `null` — single-TG row; no RGL on wire
- **Timeslot:** when the member has `timeslotOverride`, expanded row `timeslot` reflects it; otherwise inherits lean channel / mode-profile slot.

**Collisions:** if a derived name already exists, append ` 2`, ` 3`, … until unique (same rule as multi-mode).

**Length:** when name shortening is enabled at export, TG-first modes protect the trailing talk-group token(s) while shortening the leading site/callsign portion only.

### Wire name modes

Controlled by `ExportOptions.multiTalkGroupExportNameMode` (export panel). Default **`callsign_tg_abbrev`**.

| Mode                 | Composed wire name (before length trim)     | Example                      |
| -------------------- | ------------------------------------------- | ---------------------------- |
| `callsign_tg_abbrev` | `{callsign} {tgAbbrevOrName}`               | `GB7GL Sco TS2`              |
| `callsign_tg`        | `{callsign} {tgLabel}`                      | `GB7GL Scotland TS2`         |
| `callsign_name_tg`   | `{callsign} {name} {tgLabel}`               | `GB7GL Glasgow Scotland TS2` |
| `suffix_tg_abbrev`   | `{callsign2} {tgAbbrevOrName}`              | `GL Sco TS2`                 |
| `suffix_tg_number`   | `{callsign2} {number}` — failsafe           | `GL 950`                     |
| `append`             | **Legacy** — `{baseWireName} {memberLabel}` | `GL Glas Scotland TS2`       |

`callsign` includes multi-mode `-F`/`-D` suffix when present on the expanded row.

---

## Build layout (zones / scan lists)

Format builds with **zone grouping** or **scan list** traits reference **logical channel ids** internally (`memberChannelIds`). When TG expansion runs on export, each zone member expands to **all** derived wire names for that logical channel.

If fan-out would exceed the target profile cap, export truncates at the boundary and emits a warning.

---

## Import re-normalisation (best-effort)

Flat per-TG rows from a denormalised CPS may collapse into one logical library channel when:

- Same RX and TX frequency (Hz)
- Same location (lat/lon) when both set
- Same digital mode, colour code, and timeslot when set
- Compatible name stems after stripping `{base} {member}` suffixes
- Distinct talk-group `contactRef` per row

**Result:** one logical channel with `contactRef = null` (promiscuous pattern) and `rxGroupListId` pointing at an existing or newly matched RGL with collected `memberRefs`.

**Ambiguity:** leave as separate channels — no regression.

> **Studio note:** No provenance replay or wire stash on export — import mappers must reconstruct from wire rows + model fields per [DESIGN.md — Testing](../../DESIGN.md#testing).

---

## Related

- [Multi-mode expansion](channel-modes.md) — orthogonal axis
- [OpenGD77 multi-talkgroup](opengd77/multi-talkgroup.md) — N/A for OpenGD77
- [DM32 reference](dm32/README.md) — planned consumer format
