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

Stock is listed for **every** model. Where no target exists (DM-1701 and MD-9600 stock) the row is returned with `supported: false` and the picker shows it disabled as "Not supported". Firmware kinds: **stock** is the factory image, **mod** patches stock firmware (MM9PDY), **open** is a complete rewrite (OpenGD77, RadioFoundry).

Existing builds keep their `radioTargetId`; grouping is derived, so there is no persistence migration. Builds whose target is no longer in the catalog group under **Other**.

## New build (`/builds/new`)

- `RadioTargetPicker`: search, All / DMR / FM only, Any firmware / Stock / Mods & open; a section per manufacturer, a card per model, firmware as radio rows with a Mod / Open pill, export-route summary (hidden on narrow screens) and "N builds" for firmware you already have builds on.
- Sticky footer shows the selection and **Next: name it**. `?target=<radioTargetId>` preselects. Unknown ids are ignored.
- Name step is unchanged; the default name is the display label (`Baofeng DM-32UV · MM9PDY`; stock has no suffix).

## Export for radio list (`/builds`)

- **Group by Radio** (default) uses `BuildsByRadio`: collapsible manufacturer, model card, firmware sub-header, build rows (name, export routes, updated, Open). **Collapse all / Expand all** is provided. **List** keeps the flat table.
- Models with one exportable firmware show **+ New** in the header; multi-firmware models show **+ Another <firmware> build** under each firmware group. Both link to `/builds/new?target=...`.
- Not shown: "last written" per build — the model has no such field.
- Mobile: rows keep name, routes and Open; **+ New build** becomes a floating button above the tab bar; New build's footer is fixed above the tab bar.

## Adding a radio or firmware

1. Add the model (or a firmware to an existing model) in `models.ts`.
2. Add the `RadioTarget` in `catalog.ts` with `modelId` / `firmwareId`; tests in `grouping.test.ts` fail if the references are broken or a pair has two targets.
3. Follow [adding-a-new-format.md](../import-export/adding-a-new-format.md) / [adding-a-radio-adapter.md](../radio-read-write/adding-a-radio-adapter.md) for the adapters.

## Related

- Sidecars: [RadioTargetPicker](../../../src/app/components/builds/RadioTargetPicker.md), [BuildsByRadio](../../../src/app/components/builds/BuildsByRadio.md), [RadioModelPills](../../../src/app/components/builds/RadioModelPills.md)
- [modded firmware](../modded-firmware/README.md)
