# Dm32Calibration

## Purpose

Read-only DM-32UV Calibration viewer: the live calibration page and the factory sector decoded from the open debug archive (live read or file), without a project, library or build, and without opening a transport.

## Props

| Prop             | Meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `archive`        | Optional open `DebugArchive`. Absent shows "Not captured"; a non-DM-32 archive is refused.  |
| `overlayArchive` | Accepted for the shared `DebugCalibrationProps` shape and ignored (overlay is future work). |

## Usage

`RadioDebugPage` mounts it in the Calibration tab of the `dm-32uv` profile, with no overlay select. The archive is the selected retained read from the history store.

## Behaviour

Selection is `selectDm32LiveCalibration` (`integrations/radio-io/radios/dm32uv/calibrationFields.ts`), built on the same coverage classifier as Compare, so the viewer and Compare pick the same page. The live page is the lowest in-window tag `0x02` page; higher ones are listed with address and SHA-256 but not decoded; regions the classifier refuses are listed with its reason and never searched. Rows come from the field registry: offset, width, raw hex, decoded value (invalid BCD and a +0x00E battery scale outside 1-1000 stay raw with a reason; +0x00C is shown as its raw u16), firmware consumer address, and separate layout and meaning confidence. Rows without a runtime reader in 048 are labelled as such; the factory option rows carry the bit map, including that +0xA0 = 0xA3 forces the English UI. `calibration.json` and `factory-sector.json` are cross-checks only. The anti-clone key appears only in raw hex. The viewer keys itself by archive identity (`archiveKey`), so selecting another read, importing or reading again resets the hex page and source.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md), [RadioDebugPage](RadioDebugPage.md), [DM-32UV calibration reference](../../../../../docs/reference/radios/baofeng/dm-32uv/calibration.md)
