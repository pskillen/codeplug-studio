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

- Leads with [`WebSerialExperimentalAlert`](./WebSerialExperimentalAlert.md) — orange experimental warning (does not block controls).
- For **AT-D890UV** (`radio-io-at-d890uv`), shows [`AtD890WriteCoverageTable`](./AtD890WriteCoverageTable.md) — what Write updates vs defers vs leaves alone.
- When an adapter sets `prodWriteDisabled`, `resolveRadioWriteGate` hides Write on `prod` only (no adapters carry the flag today; mechanism remains for future bring-up).
- Feature-detects Web Serial **or** Capacitor USB-serial (`isRadioSerialSupported`); shows unsupported banner when neither is available.
- **Write radio** → [`WriteRadioModal`](./WriteRadioModal.md) with **Write codeplug** first (overlay modelled channels onto an **in-session** radio image — never a blank `0xff` map; never a persisted clone bag). **Grant → assemble → open → upload:** the port picker runs on the Write click (`grantRadioSerialPortForEgress`) before CPU-heavy assemble; the granted port is opened only after assemble finishes so the radio is not left in program mode during directory collection ([#1247](https://github.com/pskillen/codeplug-studio/issues/1247)). Large RadioID shadows show a determinate progress bar on **Assemble channels into image**. Inspect/snapshot is **Backup / Restore** (`/builds/:id/backup`). DM-32 Write bulk-reads live 4KB block contents in the same session (progress **Pre-write read**) then overlays the projection. UV-17Pro Write pre-write-reads the packed programming clone in the same session before overlay + full-image upload; progress checklist shows **Pre-write read** then **Upload**. OpenGD77 `upload` always pre-write-reads FLASH, then encodes onto that prior. Only **dirty 4KB FLASH sectors** are programmed on OpenGD77; if none differ, Write still finishes (SAVE_REBOOT) but the DM-1701 **stays in the current zone** — the panel shows a warning. Digital contact wire names follow **Contact export name style** (`digitalContactExportNameMode`), same as Contacts wire preview.
- Dual-bank (`SeparateDigitalIdList`) and D890 single-bank radios show a **Digital contacts** extra in the popup (library / RadioID directory / both / none). Source defaults **none** each open (leave contact banks unchanged). **Write contacts only** writes only that bank. Empty RadioID shadow + directory selected warns before write. OpenGD77 RadioID writes firmware User Database; library contacts still share the 1024-slot bank with talk groups. DM-32 RadioID writes the address book (same bank as library privates; library wins on Both); operator radio IDs stay channel DMR IDs.
- **Satellite keps** extra (when `hasSatelliteKepsWriteAdapter`) — checkbox + **Write keps only** runs the existing keps adapter; **Write codeplug** never writes keps. Preview/curation stays on **Satellite keps** (`/builds/:id/satellite-keps`, `BuildSatelliteKepsPage` — see [feature hub](../../../../docs/features/satellite-keps/README.md)).
- While busy, opens [`RadioIoProgressModal`](./RadioIoProgressModal.md) (checklist grows from `ProgressUpdate.stage` — Channels, Zones, … — plus transfer bar + keep-tab warning) for Write. `BuildSatelliteKepsPage` opens its own separate instance for `operation: 'keps-write'`. Cancel aborts via `AbortSignal`.
- **AT-D890UV Write:** same grant → assemble → in-session overlay → upload path as other radios — **no** LocalInfo serial acknowledgement modal ([#1276](https://github.com/pskillen/codeplug-studio/issues/1276)). After upload, the progress modal offers optional **Check preserved settings** — wait for the radio to finish its automatic restart, then Studio reconnects and checks settings Studio does not set against the pre-Write snapshot. **Close** skips the check without implying a problem. Restore still refuses zip vs live serial mismatch.
- Blocks in-app navigation and tab close while busy (`useUnsavedNavigationGuard`); releases the port on failure.
- Links to build **Backup / Restore** (`/builds/:id/backup`) for inspect and zip snapshot. Legacy `/radio-image` URLs redirect there.
- In-flow attribution from `descriptor.attributionIds`.

Does **not** import radio channels into the library.

## Related

- [`WriteRadioModal.md`](WriteRadioModal.md) — Write radio popup
- [`WebSerialExperimentalAlert.md`](WebSerialExperimentalAlert.md) — experimental pathway warning
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
- Services: `src/app/services/radioIoSession.ts`
