# OpenGD77 — multi-mode channel expansion

**Status:** Shipped in app — tracking archive reference (codeplug-tool#46).

## Problem

The Baofeng 1701 / OpenGD77 CPS has **no dual-mode channel row** — an FM+DMR repeater on the same frequency needs separate `Analogue` and `Digital` `Channels.csv` entries ([1701 profile](radios/baofeng-1701.md)). The internal model lets operators model one logical site with multiple mode profiles; export expands to the wire rows the radio expects.

Sibling formats differ: DM32 stock CPS uses native `Fixed Analog` / `Fixed Digital` on **one** row (archive reference #67); qDMR splits into separate `fm:` / `dmr:` channels.

## When to expand

| Internal state                         | OpenGD77 export                                        |
| -------------------------------------- | ------------------------------------------------------ |
| `multiMode: false`                     | One `Channels.csv` row per logical channel (unchanged) |
| `multiMode: true` with N mode profiles | N rows — one per profile                               |

Each expanded row uses the profile's mode for `Channel Type` (`Analogue` / `Digital` via [channels.md](channels.md)) and that profile's mode-specific fields (tones, colour code, contact, TG list, etc.). Shared fields (frequencies, location, power, rx-only, TOT, …) copy from the logical channel.

## Derived channel names

Deterministic suffix from mode category (case-sensitive FKs across files):

| Profile category             | Suffix | Example (`GB7GL`) |
| ---------------------------- | ------ | ----------------- |
| Analog (`fm`, `am`, `ssb-*`) | `-F`   | `GB7GL-F`         |
| Digital (`dmr`, `ysf`, …)    | `-D`   | `GB7GL-D`         |

**Collisions:** if a derived name already exists among export wire names (existing channels or other expanded rows), append ` 2`, ` 3`, … until unique.

**Length:** 1701 LCD display ~16 characters — export may emit a warning when a derived name exceeds the profile display limit; truncation is not applied automatically.

Implementation: `src/core/import-export/ (planned)` — `expandChannelForExport()`.

## Zone membership

Zones reference **logical channel ids** internally (`memberChannelIds`). On export, each multi-mode member expands to **all** derived wire names in zone member columns (`Channel1`…`Channel80`).

If expansion would exceed the target profile's zone member cap, export truncates at the boundary and emits a warning (see [zones.md](zones.md), [1701 profile](radios/baofeng-1701.md)).

## Import re-normalisation (best-effort)

On import, paired flat rows may collapse into one logical multi-mode channel when:

- Same normalised base name stem (after stripping `-F` / `-D` suffixes)
- Same RX and TX frequency (Hz)
- Same location (lat/lon) when both set
- `Channel Type` differs (`Analogue` vs `Digital`)

**Ambiguity:** leave as separate channels — no regression.

Decisions should surface in import preview when archive reference #113 ships.

## Related

- [#46 — multi-mode channels]archive reference
- [#36 — multi-talkgroup](multi-talkgroup.md) (orthogonal expansion axis)
- [channels.md](channels.md)
- [Data model — Channel](../../features/data-model/README.md)
