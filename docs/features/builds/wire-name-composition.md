## Purpose

Single reference for **how CPS wire names are composed** before export — which library fields, build traits, and browser export settings combine at each step. Wire naming is split across expansion axes (base name → multi-mode → multi-talkgroup → shorten); this doc maps those axes without repeating tier-3 column tables.

**Code:** `src/core/domain/channelNaming.ts`, `src/core/import-export/channelExpansion/`, `src/core/services/previewWireRows.ts`, `src/app/hooks/useExportSettings.ts`

## Pipeline overview

```text
Library channel / talk group / zone / contact
  → compose base wire name (export name mode + library fields)
  → build wireName override (optional, per entity on FormatBuild)
  → expansion (trait-dependent — see below)
  → shorten to profile nameLimit (optional, export settings)
  → effective wire name in preview + CPS files
```

Preview and export share the same options via `useExportSettings` (browser `localStorage`) plus per-build overrides on `/builds/:id/*` wire preview routes.

## Base channel name (all formats)

Before any expansion, `defaultChannelWireName` / `composeChannelWireName` uses **`Channel.callsign`**, **`Channel.name`**, and the active **export name mode**:

| Export name mode (`ChannelExportNameMode`) | Fields used                     | Example         |
| ------------------------------------------ | ------------------------------- | --------------- |
| `callsign_name` (default)                  | callsign + name                 | `GB7GL Glasgow` |
| `callsign_only`                            | callsign, else name             | `GB7GL`         |
| `name_only`                                | name, else callsign             | `Glasgow`       |
| `callsign_suffix`                          | last 2 chars of callsign + name | `GL Glasgow`    |

**Operator controls:** fallback mode on wire preview (channels) and export panel (`nameModeOverride` in localStorage). Per-channel **`Channel.abbreviation`** is used during shortening, not in the initial compose step.

**Build override:** `channelOverrides.wireName` replaces the generated base before expansion (OpenGD77) or before DM32 RX fan-out.

## Expansion axes (traits)

Traits come from the build **profile** (`traitProfileFor`). Only one expansion stack applies per format build.

| Trait                                                                  | Profiles          | What expands                                  | Wire name effect                                             |
| ---------------------------------------------------------------------- | ----------------- | --------------------------------------------- | ------------------------------------------------------------ |
| _(none)_                                                               | CHIRP flat memory | Single row per channel                        | Base name only                                               |
| `mxnChannelExpansion`                                                  | DM32              | RX group list → one row per TG/contact member | Multi-TG compose modes (below); **no** `-F`/`-D` suffix rows |
| `multiTalkGroupPerChannel`                                             | OpenGD77          | Native RGL on wire — **no fan-out**           | Base name only; TG list is a separate CPS file               |
| Multi-mode (implicit when `modeProfiles.length > 1` and `expandModes`) | OpenGD77          | One row per mode profile                      | Appends mode suffix to base name                             |

DM32 does **not** use OpenGD77 multi-mode expansion in preview or export (`expandModes: false`). Dual FM+DMR on one frequency becomes one DM32 row (Fixed Digital / Fixed Analog semantics at serialise).

### Multi-mode suffixes (OpenGD77)

When `expandModes` is true and a channel has multiple `modeProfiles`:

| Profile category             | Suffix appended to composed base | Example base → wire |
| ---------------------------- | -------------------------------- | ------------------- |
| Analog (`fm`, `am`, `ssb-*`) | `-F`                             | `GB7GL` → `GB7GL-F` |
| Digital (`dmr`, `ysf`, …)    | `-D`                             | `GB7GL` → `GB7GL-D` |

Override keys for expansion rows: `${channelId}:${modeSuffix}` (e.g. `…3333:-D`).

See [OpenGD77 multi-mode](../../reference/opengd77/multi-mode.md).

### Multi-talkgroup fan-out (DM32)

When a DMR profile has `rxGroupListId` with expandable members and `expandRxGroupLists` is true:

| `multiTalkGroupExportNameMode` | Channel fields                                  | Talk group / contact fields              | Example                      |
| ------------------------------ | ----------------------------------------------- | ---------------------------------------- | ---------------------------- |
| `callsign_tg_abbrev` (default) | callsign (+ mode tag from site wire if present) | `TalkGroup.abbreviation` or name         | `GB7GL Sco TS2`              |
| `callsign_tg`                  | callsign                                        | TG name                                  | `GB7GL Scotland TS2`         |
| `callsign_name_tg`             | callsign + `Channel.name`                       | TG name                                  | `GB7GL Glasgow Scotland TS2` |
| `suffix_tg_abbrev`             | callsign **suffix** (last 2)                    | TG abbrev or name                        | `GL Sco TS2`                 |
| `suffix_tg_number`             | callsign suffix                                 | `TalkGroup.digitalId` only               | `GL 950`                     |
| `append` (legacy)              | prior site wire name                            | member label via `talkGroupMemberSuffix` | `GL Glas Scotland TS2`       |

Private contact members use contact **name** where TG label would appear. **`RxGroupListMember.timeSlotOverride`** affects `Channels.csv` Time Slot on the expanded row — not the composed wire name.

**Operator controls:** `multiTalkGroupExportNameMode` and `useTalkGroupAbbreviation` on export panel (DM32 builds). Override keys: `${channelId}:${memberRefKey}`.

See [multi-talkgroup-expansion](../../reference/multi-talkgroup-expansion.md).

## Shortening (all entity kinds that have wire names)

When `shortenNames` is true and the name exceeds the profile **`nameLimit`** (or `maxNameLength` override):

| Entity                   | Prefer before dictionary                               | Protected suffix                                                     |
| ------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------- |
| Channel (base)           | `Channel.abbreviation` if `useChannelAbbreviation`     | Multi-mode `-F`/`-D` preserved                                       |
| Channel (multi-TG row)   | TG abbrev in TG-first modes                            | Trailing TG token protected in `callsign_tg_*` / `suffix_tg_*` modes |
| Talk group               | `TalkGroup.abbreviation` if `useTalkGroupAbbreviation` | —                                                                    |
| Zone / contact / RX list | Dictionary / vowel squeeze on name                     | —                                                                    |

Dictionary: `dictionary.generated.ts` (`npm run generate:abbreviations`).

See [name-shortening.md](../import-export/name-shortening.md).

## Other entity wire names

| Entity                   | Default generated name          | Override field                  |
| ------------------------ | ------------------------------- | ------------------------------- |
| Zone                     | `Zone.name`                     | `zoneOverrides.wireName`        |
| Talk group               | `TalkGroup.name` (then shorten) | `talkGroupOverrides.wireName`   |
| Digital / analog contact | contact `name`                  | `contactOverrides.wireName`     |
| RX group list            | list `name`                     | `rxGroupListOverrides.wireName` |

Talk groups and contacts also carry **reference notes** in wire preview when not used by exported channels (`Not referenced by exported channels`).

## Zone membership vs wire names

**Export inclusion** for channels (`exportUnlinkedChannels`) uses **library zone membership** (`Zone.members`) plus any **`zoneGrouping` layout `channelIds`** on the build. There is no separate DM32-only zone membership for inclusion — DM32 **`ZoneGroupingLayout`** zone entries hold export flags (scratch channel, scan list, carrier frequency), not an alternate member list.

Channel↔zone linkage for assemble and wire-preview hide uses `zoneLinkedChannelIds` in `assemble.ts`.

## Related

- [wire-preview.md](wire-preview.md) — UI workflow and hide toggle
- [zone-grouping.md](zone-grouping.md) — library zones vs build layout
- [name-shortening.md](../import-export/name-shortening.md) — pipeline detail
- [profiles.md](profiles.md) — trait profiles per radio
