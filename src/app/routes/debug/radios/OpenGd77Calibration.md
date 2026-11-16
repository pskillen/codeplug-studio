# OpenGd77Calibration

## Purpose

Read-only viewer for the OpenGD77 calibration working copy (DM-1701 and MD-9600 profiles) from the open debug archive (live read or file), without a project, library or build, and without opening a transport.

## Props

| Prop             | Meaning                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `archive`        | Optional open `DebugArchive`. Absent shows "No capture".                                                                        |
| `overlayArchive` | Optional second retained read. Overlay and Differs columns appear only when it selects as usable for the same model and marker. |

## Usage

`RadioDebugPage` mounts it in the Calibration tab of both OpenGD77 profiles (the `Calibration` field of the descriptor), with the "Calibration overlay" select sharing the history compare id.

## Behaviour

Selection is `selectOpenGd77Calibration` (`integrations/radio-io/radios/opengd77/debugCalibration.ts`), the same one Compare uses. States: no archive; not captured (a Backup archive or an older read); unavailable with the reason (no or invalid FirmwareInfo, a radio type that does not belong to the archive model, a region with the wrong address, length, role or path, or stored bytes of the wrong size; the Hex tab still shows the bytes); and ok. In the ok state the page always shows "OpenGD77 working copy, not stock factory calibration", "Not validated on hardware", the source basis line with the radio's reported revision and build date, the local-marker line and the address and length. Rows are grouped (Reference, Oscillator, Power, RX tuning, Squelch, CTCSS, DCS, Gains, Frequency points) with offset, width, raw hex, decoded value, unit, a Used by column (what in OpenGD77 reads the bytes, or "not used by OpenGD77"), and separate layout and meaning confidence (traced, partly, unknown) with the source evidence in the note. Frequency points decode to MHz (little-endian BCD, 10 Hz units) with the raw bytes kept, oscillator tune shows the signed trim (byte - 128), power rows name their watt point for the model, and the DM-1701 shows a note that its working copy is scaled and very-low is synthesised. With the marker absent only raw bytes are shown. The unnamed ranges are listed as "not used by OpenGD77; stock meaning unknown", then all 512 bytes in paged raw hex. Values are never coloured and no ranges or health verdicts are given. An overlay of another model, another marker state or an unusable read is refused with a reason and shows nothing from it. The viewer is keyed by archive identity, so replacing the archive resets the page.

## Related

[Radio debug](../../../../../docs/features/radio-debug/README.md), [RadioDebugPage](RadioDebugPage.md), [OpenGD77 calibration reference](../../../../../docs/reference/radios/opengd77/calibration.md), [DM-1701](../../../../../docs/reference/radios/baofeng/dm-1701/calibration.md) and [MD-9600](../../../../../docs/reference/radios/tyt/md-9600/calibration.md) calibration
