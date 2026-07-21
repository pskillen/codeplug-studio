# NeonPlug merge-into-base export

Merge Studio’s projected `CodeplugData` into a **radio-read donor** `.neonplug` so operators can write back without wiping radio settings.

**Code:** `parseNeonplugZip` / `mergeNeonplugCodeplug` in `src/core/import-export/formats/neonplug/merge.ts`; donor retain helpers in `donorRetain.ts`; wired via `exportBuildZip({ baseNeonplugBytes })` or `FormatBuild.cpsWireHydration` (`formatId: neonplug`).

**Not** library modelling — opaque retain bags are a labelled export-boundary escape hatch (`CpsWireHydration` / NeonPlug `NeonplugDonorBag`). Modelled channels/zones/contacts still serialise from the Studio model (no wire-stash replay). Product workflow: [neonplug feature hub](../../features/import-export/neonplug/README.md).

## Policy

| Key                                                                                  | Source on merge                                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channels`, `zones`, `scanLists`, `contacts`, `rxGroups`                             | **Studio projection** (wholesale replace)                                                                                                                                                    |
| `radioIds`                                                                           | **Always donor** (Studio does not model operator DMR IDs)                                                                                                                                    |
| `quickContacts`, `messages`, emergencies, `encryptionKeys`, `digitalEmergencyConfig` | **Donor**                                                                                                                                                                                    |
| `radioSettings` (incl. nested VFOs)                                                  | **Donor**, then **APRS (+ related GPS) leaf patch** from Studio when `Library.aprsConfiguration` is set ([aprs.md](aprs.md), [#559](https://github.com/pskillen/codeplug-studio/issues/559)) |
| `radioInfo`                                                                          | **Donor**                                                                                                                                                                                    |
| `version`                                                                            | NeonPlug-compatible envelope (`1.0.0`)                                                                                                                                                       |
| `exportDate`                                                                         | Set to now on merge                                                                                                                                                                          |

Channels are not slot-patched against unused base channel numbers — Studio replaces the full `channels[]` array.

## Donor sources (priority)

1. **Session upload** — `baseNeonplugBytes` on this export call (overrides stored bag).
2. **Build hydration** — DM32UV persists retain slices on `FormatBuild.cpsWireHydration` after a successful upload; merge uses that when no session file is supplied. The bag is part of the build row and **round-trips with native YAML** project export/import.
3. **Neither** — greenfield path (no merge).

Encryption key material may be present in the retained bag for merge fidelity; the read-only NeonPlug settings UI shows **counts only**, never key bytes.

## Warnings

- Non-fatal if donor `radioInfo.model` disagrees with the Studio profile’s expected model (`DP570UV` / `UV5R-Mini`).
- Invalid ZIP / missing `codeplug.json` / bad JSON → hard error (no download).
- When library APRS is set on **greenfield** (no donor): warn that APRS globals require merge-into-base (`radioSettings` stays `null`).

## Greenfield vs merge

| Path                                      | Settings / `radioIds` / ancillaries | Safe to write to radio? |
| ----------------------------------------- | ----------------------------------- | ----------------------- |
| **Merge** (upload or stored DM32UV donor) | Retained from donor                 | Yes (intended path)     |
| **Greenfield** (no donor)                 | Empty / `null` as on M1 serialise   | **No** — browse only    |

See [radio-info-and-settings.md](radio-info-and-settings.md) loss table.
