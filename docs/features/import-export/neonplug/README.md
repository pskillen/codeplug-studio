# NeonPlug interchange — import / export

Product behaviour for NeonPlug `.neonplug` files in Codeplug Studio. Wire tables live in the tier-3 [NeonPlug reference](../../../reference/neonplug/README.md).

**Tracking:** Epic [#536](https://github.com/pskillen/codeplug-studio/issues/536) · scaffold [#538](https://github.com/pskillen/codeplug-studio/issues/538) · channels + ZIP [#539](https://github.com/pskillen/codeplug-studio/issues/539) · org entities [#540](https://github.com/pskillen/codeplug-studio/issues/540) · m×n + scratch [#553](https://github.com/pskillen/codeplug-studio/issues/553) · merge-into-base [#551](https://github.com/pskillen/codeplug-studio/issues/551) · donor persist + settings view [#552](https://github.com/pskillen/codeplug-studio/issues/552) · export UI [#542](https://github.com/pskillen/codeplug-studio/issues/542) · wire reference [#537](https://github.com/pskillen/codeplug-studio/issues/537) · no-TX sentinel [#561](https://github.com/pskillen/codeplug-studio/issues/561) · empty scan floor [#564](https://github.com/pskillen/codeplug-studio/issues/564) · empty-layout scans + carriers [#562](https://github.com/pskillen/codeplug-studio/issues/562) · APRS globals [#559](https://github.com/pskillen/codeplug-studio/issues/559)

**Source:** `src/core/import-export/formats/neonplug/` (profiles, export adapter, `.neonplug` ZIP packaging)

## Implementation status

| Area                                                      | Status  | Notes                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire reference                                            | Shipped | [reference/neonplug/](../../../reference/neonplug/README.md) — [#537](https://github.com/pskillen/codeplug-studio/issues/537)                                                                                                                                                                                                                |
| Format scaffold (`FormatId`, catalog, traits)             | Shipped | [#538](https://github.com/pskillen/codeplug-studio/issues/538) — `neonplug` in catalog; profiles + `TRAIT_PROFILES`                                                                                                                                                                                                                          |
| Export channels + `.neonplug` ZIP                         | Shipped | [#539](https://github.com/pskillen/codeplug-studio/issues/539) — `assemble` → `codeplug.json` → fflate ZIP; receive-only 87–136 MHz emits TX `1666.666` ([#561](https://github.com/pskillen/codeplug-studio/issues/561))                                                                                                                     |
| Export zones / scan / contacts / RX groups (DM32 profile) | Shipped | [#540](https://github.com/pskillen/codeplug-studio/issues/540) — org arrays + channel FKs; `radioIds[]` omitted on greenfield; empty `scanLists` floored with ≥1 member ([#564](https://github.com/pskillen/codeplug-studio/issues/564)); empty-layout zone scan + carriers ([#562](https://github.com/pskillen/codeplug-studio/issues/562)) |
| m×n expansion + scratch (DM32UV)                          | Shipped | [#553](https://github.com/pskillen/codeplug-studio/issues/553) — see [export-projections.md](export-projections.md)                                                                                                                                                                                                                          |
| Merge into radio-read base                                | Shipped | [#551](https://github.com/pskillen/codeplug-studio/issues/551) — retain settings / `radioIds`; see [merge.md](../../../reference/neonplug/merge.md)                                                                                                                                                                                          |
| Build UI + export download                                | Shipped | [#542](https://github.com/pskillen/codeplug-studio/issues/542) — merge-first + secondary greenfield                                                                                                                                                                                                                                          |
| DM32UV donor persist + read-only settings                 | Shipped | [#552](https://github.com/pskillen/codeplug-studio/issues/552) — `FormatBuild.cpsWireHydration`; NeonPlug settings nav                                                                                                                                                                                                                       |
| DM-32UV APRS globals (slots 1–8 + settings) on merge      | Shipped | [#559](https://github.com/pskillen/codeplug-studio/issues/559) — patches donor `radioSettings`; see [aprs.md](../../../reference/neonplug/aprs.md)                                                                                                                                                                                           |
| UV5R-Mini profile export                                  | Shipped | [#541](https://github.com/pskillen/codeplug-studio/issues/541) — flat-memory Channels UI (shared trait page); FM/AM-only packing + serialise skip/warn; org arrays empty; caps 999 / 12                                                                                                                                                      |
| UV5R donor persist / settings view                        | Shipped | [#554](https://github.com/pskillen/codeplug-studio/issues/554) — same `cpsWireHydration` + NeonPlug settings nav as DM32UV; UV5R settings decode labelled `radioSpecific` sections (DM32 shallow leaf preview unchanged)                                                                                                                     |
| Import parse → library + build                            | Planned | [#543](https://github.com/pskillen/codeplug-studio/issues/543)                                                                                                                                                                                                                                                                               |
| Import dropzone                                           | Planned | [#544](https://github.com/pskillen/codeplug-studio/issues/544)                                                                                                                                                                                                                                                                               |
| 1-click handoff to neonplug.app                           | Stretch | [#545](https://github.com/pskillen/codeplug-studio/issues/545)                                                                                                                                                                                                                                                                               |

## Why a separate format

Studio already exports **DM-32** via CPS CSV and **UV-5R Mini** via CHIRP CSV. NeonPlug’s preferred pathway is a single `.neonplug` ZIP containing `codeplug.json`, then in-browser radio write over Web Serial / BLE. That interchange is a sibling CPS format — same library, new format builds — not a projection bolted onto the CSV adapters. Sibling export UIs: DM32 CSV shows a strong prefer-NeonPlug warning; CHIRP UV-5R shows a blue FYI about the NeonPlug browser pathway ([#556](https://github.com/pskillen/codeplug-studio/issues/556)).

## Profiles

| Profile id          | Label                         | Traits                                                  | Caps note                                                                                                 |
| ------------------- | ----------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `neonplug-dm32uv`   | Baofeng DM-32UV (NeonPlug)    | Zone grouping + zone-derived scan lists + m×n expansion | Same numeric caps as DM32 CPS `dm32-baofeng-dm32uv`                                                       |
| `neonplug-uv5rmini` | Baofeng UV-5R Mini (NeonPlug) | Flat memory + per-channel scan flag                     | NeonPlug binary **999** memories / **12**-char names — same caps as CHIRP CSV `chirp-uv5r` (sibling path) |

## Export delivery

1. Adapter serialises `codeplug.json` as a **string** (`multi-file` with one entry).
2. `exportBuildZip` wraps that string with **fflate** (`buildNeonplugZip`) → `.neonplug` binary.
3. Optional **donor**: session upload bytes **or** build-stored `cpsWireHydration` → `mergeNeonplugCodeplug` → re-ZIP (merge-first / radio-write path).

**DM32UV:** channels plus zones, zone-derived scan lists (including empty-layout fallback and `{zone} Scan` carriers — [export-projections.md](export-projections.md)), contacts (talk groups then digital contacts), and RX groups; channel `contactId` / `rxGroupListId` / `scanListId` wired. Default export expands RX-list channels (m×n + scratch). **Greenfield** leaves `radioIds[]` and ancillaries empty (`radioSettings: null`); when library APRS is set, export warns that globals require merge. **Merge** retains donor `radioIds`, `radioSettings`, and other unmodelled keys, then **overwrites the APRS (+ related GPS) leaf fields** from `Library.aprsConfiguration` ([aprs.md](../../../reference/neonplug/aprs.md)). A successful donor upload persists retain slices on the format build so repeat exports do not require re-upload. **UV5R-Mini:** channels only on greenfield (org arrays empty); FM/AM flat-memory slots; same donor persist + NeonPlug settings view as DM32UV (ancillary bags typically empty).

See [file-format.md](../../../reference/neonplug/file-format.md) and [merge.md](../../../reference/neonplug/merge.md).

## Operator workflow

1. Curate channels (and DMR entities) in the **library**.
2. Create a **NeonPlug build** for the target radio profile (`/builds/new`).
3. In NeonPlug, **read from the radio** and export a donor `.neonplug`.
4. On the build export page, upload the donor once (saved on the build) → **Download for radio write** (or save the merge to Drive).
5. Later exports reuse the stored donor; replace or clear from Export, or inspect on **NeonPlug settings**.
6. Import the merged file in NeonPlug → write to the radio.

**Persistence:** donor retain slices live on `FormatBuild.cpsWireHydration` — IndexedDB with the project, and **included** when the operator exports/imports native YAML (Drive or download). Do not commit personal project YAML into the Studio repo.

**Secondary:** **Download greenfield `.neonplug`** for browsing / debug only — it omits radio settings and is **not safe to write back** without a donor merge.

## Related

- [import-export hub](../README.md)
- [Export projections (m×n + scratch)](export-projections.md)
- [NeonPlug wire reference](../../../reference/neonplug/README.md)
- [Merge policy](../../../reference/neonplug/merge.md)
- Sibling formats: [DM32](../dm32/README.md), [CHIRP](../chirp/README.md)
- External: [NeonPlug](https://github.com/infamy/NeonPlug) · [neonplug.app](https://neonplug.app)
