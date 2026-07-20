# NeonPlug merge-into-base export

Merge Studio’s projected `CodeplugData` into a **radio-read donor** `.neonplug` so operators can write back without wiping radio settings.

**Code:** `parseNeonplugZip` / `mergeNeonplugCodeplug` in `src/core/import-export/formats/neonplug/merge.ts`; wired via `exportBuildZip({ baseNeonplugBytes })`.

**Not** library persistence — opaque donor bags stay at the export boundary only (no wire-stash into Studio entities).

## Policy

| Key | Source on merge |
| --- | --- |
| `channels`, `zones`, `scanLists`, `contacts`, `rxGroups` | **Studio projection** (wholesale replace) |
| `radioIds` | **Always donor** (Studio does not model operator DMR IDs) |
| `quickContacts`, `messages`, emergencies, `encryptionKeys`, `digitalEmergencyConfig` | **Donor** |
| `radioSettings` (incl. nested VFOs) | **Donor** |
| `radioInfo` | **Donor** |
| `version` | NeonPlug-compatible envelope (`1.0.0`) |
| `exportDate` | Set to now on merge |

Channels are not slot-patched against unused base channel numbers — Studio replaces the full `channels[]` array.

## Warnings

- Non-fatal if donor `radioInfo.model` disagrees with the Studio profile’s expected model (`DP570UV` / `UV5R-Mini`).
- Invalid ZIP / missing `codeplug.json` / bad JSON → hard error (no download).

## Greenfield vs merge

| Path | Settings / `radioIds` / ancillaries | Safe to write to radio? |
| --- | --- | --- |
| **Merge** (upload donor) | Retained from donor | Yes (intended path) |
| **Greenfield** (no donor) | Empty / `null` as on M1 serialise | **No** — browse only |

See [radio-info-and-settings.md](radio-info-and-settings.md) loss table.
