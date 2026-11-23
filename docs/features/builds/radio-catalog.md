# Radio catalog: manufacturer, model, firmware

How radio targets are organised for **New build** and the **Export for radio** list. Hub: [README.md](README.md). Tracking: [#1493](https://github.com/pskillen/codeplug-studio/issues/1493).

## Purpose

A radio target (what a build points at via `radioTargetId`) is one hardware **model** running one **firmware variant**. The catalog carries that structure as vendor-neutral metadata so the UI groups builds and targets the same way everywhere, and so a landing-page support matrix ([#1494](https://github.com/pskillen/codeplug-studio/issues/1494)) can reuse it.

```text
Manufacturer › Model (hardware) › Firmware variant › Build instances (0..n, user-named)
```

A profile can have several instances: different codeplugs, several radios of one type, or a club programming identical radios with different roles. Nothing in the hierarchy limits that.

## Code anchors

| Module (`@core/radio-targets`) | Role                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `models.ts`                    | `RADIO_MODELS`: `RadioModel` (manufacturer, label, form factor, `radioClass` `dmr`/`fm`, ordered `firmware[]`); `FirmwareVariant` (`id`, `label`, `kind` `stock`/`mod`/`open`) |
| `catalog.ts`                   | `RADIO_TARGETS`: each `RadioTarget` references `modelId` + `firmwareId`, traits and egress                                                                                     |
| `grouping.ts`                  | `groupRadioCatalog`, `groupBuildsByRadio`, `countBuildsByTarget`, `radioTargetDisplayLabel`, `manufacturerForRadioTarget`, `egressSummary`                                     |

Stock is listed for **every** model. Where no target exists (DM-1701, MD-9600, RT84 and RT90 stock) the row is returned with `supported: false` and the picker shows it disabled as "Not supported". Firmware kinds: **stock** is the factory image, **mod** patches stock firmware (MM9PDY), **open** is a complete rewrite (OpenGD77, RadioFoundry).

Existing builds keep their `radioTargetId`; grouping is derived, so there is no persistence migration. Builds whose target is no longer in the catalog group under **Other**.

## New build (`/builds/new`)

- `RadioTargetPicker`: search, All / DMR / FM only, Any firmware / Stock / Mods & open; a section per manufacturer, a card per model, firmware as radio rows with a Mod / Open pill, export-route summary (hidden on narrow screens) and "N builds" for firmware you already have builds on.
- Sticky footer shows the selection and **Next: name it**. `?target=<radioTargetId>` preselects. Unknown ids are ignored.
- Name step is unchanged; the default name is the display label (`Baofeng DM-32UV · MM9PDY`; stock has no suffix).

## Export for radio list (`/builds`)

- Manufacturer heading (with build count), then one **card per radio model** (`BuildsByRadio`): model label, DMR / FM pill, build count. Models are alphabetical; builds inside a card run in the model's firmware order (stock first), then by name.
- Each build is **one link row** that opens it: name, relative updated time (full date on hover), firmware pill, transfer paths. There is no Open button.
- One **New build** button in the page header goes to `/builds/new`. There are no per-radio "+ New" or "+ Another <firmware> build" links.
- **Search** (instant, filter-only): every word must match, case-insensitively, somewhere in build name, manufacturer, model, firmware label or transfer paths. Matches are highlighted and counted; no match shows an empty state. There is no Group by switch or flat list view.
- Not shown: "last written" per build — the model has no such field.
- Mobile: one column; each row shows name and time, then firmware and paths; **New build** becomes a floating button above the tab bar; New build's footer is fixed above the tab bar.

## Support matrix (landing page)

`supportMatrix.ts` projects the catalog into the radio x feature matrix on the empty Home page ([onboarding](../onboarding/README.md)). Nothing is hand-ticked. Adding a model, firmware or target updates the page; a model with a new flasher needs its entry in `src/core/firmware/radioTargets.ts` (`modelIdForFirmwareRadio`).

| Column                      | Derived from                                                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write via cable / Read back | A `web-serial` entry in the target's `compatibleEgress`, filtered by the site (radio-io descriptor exists; per-profile Write gate) via `supportMatrixAvailability`                                                                                                                      |
| CPS file                    | Any `cps-file` entry in `compatibleEgress`                                                                                                                                                                                                                                              |
| Satellite keps              | A keps write adapter for a `web-serial` egress and Write offered on this site (`supportMatrixAvailability.satelliteKeps`; core defaults to off when the hook is omitted). RadioFoundry cells show † when the matrix has a feature note — satellite tracking depends on the connected build, not the board alone.                                                                                                                |
| Zones                       | `ZoneGrouping`                                                                                                                                                                                                                                                                          |
| Scan lists                  | `ScanLists` / `DedicatedScanLists` / `ZoneAsScanList` = supported; `PerChannelScanFlag` only = partial                                                                                                                                                                                  |
| Zone = scan                 | `ZoneAsScanList`                                                                                                                                                                                                                                                                        |
| Talk groups                 | DMR model with a target = supported; FM model = not applicable                                                                                                                                                                                                                          |
| Multi-TG channel            | `MultiTalkGroupPerChannel` (FM = not applicable)                                                                                                                                                                                                                                        |
| Flash                       | Stock = not applicable. A `mod` firmware on a model with a flasher = supported when the site offers that flasher (prod gate, platform). Open firmware = not supported (the flasher installs MM9PDY)                                                                                     |
| Channel modes               | One column per mode that at least one target's RF capability row lists, in a fixed order (`listSupportModeColumns`). Supported where that target's row lists the mode; digital modes are not applicable on FM radios; no target → not supported. Mode columns never count in the score. |
| Transfer path               | Per supported mode: cable when Write via cable is supported, CPS file when CPS export is supported. A fact in `supportEvidence.ts` can restrict which paths apply. Shown in the cell tooltip.                                                                                           |
| Evidence                    | `on air`, `bench`, or `unverified`, from `src/core/radio-targets/supportEvidence.ts` (the firmware project's own test records, each with a source sentence). Blank where nothing is recorded.                                                                                           |
| Firmware build              | RadioFoundry rows name the commit Studio was checked against (`supportEvidence.ts`, from the pin in `src/core/radios/radiofoundry/firmware.ts`).                                                                                                                                        |
| †                           | A condition on a cell (for example NXDN on the AT-D890UV MM9PDY only when the radio reports NXDN enabled).                                                                                                                                                                              |

A model + firmware with no target is "not supported" in every column. The "Most features" card is the supported firmware with the highest score (supported = 1, partial = 0.5), counting feature columns only, shown only when a model has more than one supported firmware.

### Updating the evidence

Evidence is the only hand-kept part of the matrix; every other cell is derived from the catalog. Each evidence row cites its source in `supportEvidence.ts`. A new RadioFoundry target needs FM and DMR evidence rows (a test enforces this). A new channel mode column appears when a target's RF capability row lists that mode — no extra evidence row is required unless you want to record testing for it.

## Adding a radio or firmware

1. Add the model (or a firmware to an existing model) in `models.ts`.
2. Add the `RadioTarget` in `catalog.ts` with `modelId` / `firmwareId`; tests in `grouping.test.ts` fail if the references are broken or a pair has two targets.
3. Follow [adding-a-new-format.md](../import-export/adding-a-new-format.md) / [adding-a-radio-adapter.md](../radio-read-write/adding-a-radio-adapter.md) for the adapters.

## Related

- Sidecars: [RadioTargetPicker](../../../src/app/components/builds/RadioTargetPicker.md), [BuildsByRadio](../../../src/app/components/builds/BuildsByRadio.md), [RadioModelPills](../../../src/app/components/builds/RadioModelPills.md)
- [modded firmware](../modded-firmware/README.md)
