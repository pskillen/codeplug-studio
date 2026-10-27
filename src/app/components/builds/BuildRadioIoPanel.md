# BuildRadioIoPanel

## Purpose

Build Export chrome for **direct serial** write (desktop **Web Serial**, Android Capacitor **USB-OTG**) on **Direct radio** (`radio-io`) egress pathways when a registered adapter matches the profile. Write runs `assemble` → in-session overlay → upload. Inspect/snapshot lives on **Backup / Restore**. No CPS ZIP/CSV for this format.

## Props

| Prop     | Type         | Description                                                                     |
| -------- | ------------ | ------------------------------------------------------------------------------- |
| `build`  | `RadioBuild` | Active radio build                                                              |
| `egress` | `EgressPath` | Active direct-serial pathway (`formatId`/`profileId`/hydration live here, #654) |

## Usage

```tsx
<BuildRadioIoPanel build={build} egress={activeEgress} />
```

Renders nothing when `descriptorsForEgress(egress)` is empty. Must render under `BuildLayoutProvider` (uses `reloadEgressPaths`).

## Behaviour

- **Unfinished range change (#1369):** on the AT-D890UV the red [`RangeChangeBanner`](../dangerZone/RangeChangeBanner.md) sits above the header card whenever this browser holds an unfinished range-change record.
- **Layout (#1393 PR 4d):** [`WriteHeaderCard`](./RadioIoPanelCards/RadioIoPanelCards.md) (radio label, **Write radio…** as the one primary action, a one-line build summary from `radioIoPanelFacts`), **Before you write** (only the rows that apply), the AT-D890UV **Radio settings** card, the **Backup** card (radios whose descriptor supports backup), the AT-D890UV coverage table collapsed under **What Write updates** ([`AtD890WriteCoverageTable`](./AtD890WriteCoverageTable.md)), the AT-D890UV **Danger zone** card (collapsed, after **What Write updates**; only when `listOfferedDangerZoneTools` offers a tool; see [danger-zone.md](../../../docs/features/radio-read-write/danger-zone.md)), and a one-line experimental note whose **Details** link opens the full warning and the how-Write-works paragraph. The orange [`WebSerialExperimentalAlert`](./WebSerialExperimentalAlert.md) stays on the Backup page.
- The build summary and the receive-range row come from one `loadLibrarySlice` + `assemble` pass when the panel mounts; they are informational and stay out if the load fails. Channels outside the radio's receive bands are counted from the library minus the build's exclusions, the same set the export warning uses.
- When an adapter sets `prodWriteDisabled`, `resolveRadioWriteGate` hides Write on `prod` only (no adapters carry the flag today; mechanism remains for future bring-up).
- Feature-detects Web Serial **or** Capacitor USB-serial (`isRadioSerialSupported`); shows unsupported banner when neither is available.
- **Write radio** opens the [`RadioWriteStepper`](./RadioWriteStepper/RadioWriteStepper.md): What to write → Read → Review → Writing → Restart & check → Done (#1393). The Write overlays modelled channels onto an **in-session** radio image — never a blank `0xff` map; never a persisted clone bag. **Grant → assemble → open → read → Review → upload:** the port picker runs on the **Connect & read** click (`grantRadioSerialPortForEgress`) before CPU-heavy assemble; the granted port is opened only after assemble finishes so the radio is not left in program mode during directory collection ([#1247](https://github.com/pskillen/codeplug-studio/issues/1247)). The session is held open on Review (`beforeTransmit` in `uploadPreparedRadioWrite`); Cancel there writes nothing. Inspect/snapshot is **Backup / Restore** (`/builds/:id/backup`). DM-32 Write bulk-reads live 4KB block contents in the same session (progress **Pre-write read**) then overlays the projection. UV-17Pro Write pre-write-reads the packed programming clone in the same session before overlay + full-image upload. OpenGD77 `upload` always pre-write-reads FLASH, then encodes onto that prior. Only **dirty 4KB FLASH sectors** are programmed on OpenGD77; if none differ, Write still finishes (SAVE_REBOOT) but the DM-1701 **stays in the current zone** — the Done step shows a warning. Digital contact wire names follow **Contact export name style** (`digitalContactExportNameMode`), same as Contacts wire preview.
- Dual-bank (`SeparateDigitalIdList`) and D890 single-bank radios show a **Digital contacts** part (library / RadioID directory / both; unticked leaves the contact banks unchanged). Contacts alone writes only that bank. Empty RadioID shadow + directory selected warns before the read. OpenGD77 RadioID writes firmware User Database; library contacts still share the 1024-slot bank with talk groups. DM-32 RadioID writes the address book (same bank as library privates; library wins on Both); operator radio IDs stay channel DMR IDs.
- **Satellite keps** part (when `hasSatelliteKepsWriteAdapter`): ticked with the codeplug it writes after the radio restarts, in a new session, on the AT-D890UV and OpenGD77 (`satelliteKepsSameSessionAfterUpload` is empty today; #1406). Keps alone is a tick, not a button. Preview/curation stays on **Satellite keps** (`/builds/:id/satellite-keps`, `BuildSatelliteKepsPage` — see [feature hub](../../../../docs/features/satellite-keps/README.md)).
- Progress during Read and Writing is the stepper's planned list (shown in full before the first byte, with an overall bar and time remaining). `BuildSatelliteKepsPage` and Backup / Restore still use [`RadioIoProgressModal`](./RadioIoProgressModal.md). Abort via `AbortSignal`.
- **AT-D890UV Write:** same grant → assemble → in-session overlay → upload path as other radios — **no** LocalInfo serial acknowledgement modal ([#1276](https://github.com/pskillen/codeplug-studio/issues/1276)). After upload, step 5 waits for the radio's automatic restart (about 20 s) and offers the optional **Check write** — Studio reconnects and checks settings Studio does not set against the pre-Write snapshot. **Skip and finish** skips the check without implying a problem. Restore still refuses zip vs live serial mismatch.
- Blocks in-app navigation and tab close while a read or transfer runs (`useUnsavedNavigationGuard`); releases the port on failure.
- The Backup card links to build **Backup / Restore** (`/builds/:id/backup`) for inspect and zip snapshot. Legacy `/radio-image` URLs redirect there.
- In-flow attribution from `descriptor.attributionIds`.

Does **not** import radio channels into the library.

## Related

- [`RadioWriteStepper.md`](RadioWriteStepper/RadioWriteStepper.md) — the Write dialog
- [`WebSerialExperimentalAlert.md`](WebSerialExperimentalAlert.md) — experimental pathway warning
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
- Services: `src/app/services/radioIoSession.ts`
