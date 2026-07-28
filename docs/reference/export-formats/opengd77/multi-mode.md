# OpenGD77 — multi-mode channel expansion

**Status:** Shipped — `expandChannelWireRows` in [`multiMode.ts`](../../../../src/core/import-export/channelExpansion/multiMode.ts).

## Problem

The Baofeng 1701 / OpenGD77 CPS has **no dual-mode channel row** — an FM+DMR repeater on the same frequency needs separate `Analogue` and `Digital` `Channels.csv` entries ([`opengd77-1701`](profiles.md)). The internal model lets operators model one logical site with multiple mode profiles; export expands to the wire rows the radio expects.

Sibling formats differ: DM32 stock CPS uses native `Fixed Analog` / `Fixed Digital` on **one** row; qDMR splits into separate `fm:` / `dmr:` channels.

## When to expand

| Internal state                                     | OpenGD77 export                                 |
| -------------------------------------------------- | ----------------------------------------------- |
| Single mode profile (`modeProfiles.length === 1`)  | One `Channels.csv` row / one serial channel DTO |
| Multiple mode profiles (`modeProfiles.length > 1`) | N rows / N DTOs — one per exportable profile    |

Each expanded row uses the profile's mode for `Channel Type` (`Analogue` / `Digital` via [channels.md](channels.md)) and that profile's mode-specific fields (tones, colour code, contact, TG list, etc.). Shared fields (frequencies, location, power, rx-only, TOT, …) copy from the logical channel.

**CSV** and **Web Serial Write** both call `expandOpenGd77ChannelWireRows` (via `serialiseChannels` and `expandAssembledChannelsToRadioDtos` respectively). Serial maps each expanded row to its own `RadioChannelDto` with `mode: 'analog'` or `mode: 'digital'` — never `fixed-digital`.

For modelled radios (`opengd77-1701`, `opengd77-md9600`, and matching `radio-io-opengd77-*` Write profiles), only **analogue + DMR** mode profiles expand — YSF, D-STAR, P25, and other digital modes are dropped with an export warning ([#773](https://github.com/pskillen/codeplug-studio/issues/773)). The same filter applies on CSV export and serial Write.

Controlled by build export option `expandModes` (default `true` on OpenGD77 adapter).

## Derived channel names

Deterministic suffix from mode category (case-sensitive FKs across files):

| Profile category             | Suffix | Example (`GB7GL`) |
| ---------------------------- | ------ | ----------------- |
| Analog (`fm`, `am`, `ssb-*`) | `-F`   | `GB7GL-F`         |
| DMR                          | `-D`   | `GB7GL-D`         |

Other digital modes are not emitted for modelled OpenGD77 radios (see above).

**Collisions:** if a derived name already exists among export wire names (existing channels or other expanded rows), append ` 2`, ` 3`, … until unique.

**Length:** 1701 LCD display ~16 characters — export may emit a warning when a derived name exceeds the profile display limit; shortening pipeline applies when enabled.

Implementation: [`expandChannelWireRows`](../../../../src/core/import-export/channelExpansion/multiMode.ts) · suffix helpers in [`modeExportSuffix.ts`](../../../../src/core/import-export/channelExpansion/modeExportSuffix.ts).

## Zone membership

Zones reference **logical channel ids** internally (`memberChannelIds`). On export, each multi-mode member expands to **all** derived wire names in zone member columns (`Channel1`…`Channel80`).

If expansion would exceed the target profile's zone member cap, export truncates at the boundary and emits a warning (see [zones.md](zones.md), [`opengd77-1701`](profiles.md)).

## Import re-normalisation (planned)

On import (not shipped), paired flat rows may collapse into one logical multi-mode channel when:

- Same normalised base name stem (after stripping `-F` / `-D` suffixes)
- Same RX and TX frequency (Hz)
- Same location (lat/lon) when both set
- `Channel Type` differs (`Analogue` vs `Digital`)

**Ambiguity:** leave as separate channels — no regression. Decisions should surface in import preview when [#524](https://github.com/pskillen/codeplug-studio/issues/524) ships.

## Related

- [multi-talkgroup.md](multi-talkgroup.md) (orthogonal expansion axis)
- [channels.md](channels.md)
- [Data model — Channel](../../../features/data-model/README.md)
