# OpenGd77Settings

## Purpose

Read-only view of the OpenGD77 firmware settings struct and the codeplug device info and general settings (DM-1701 and MD-9600), decoded from the open debug archive's captured FLASH spans. It never reads a radio; the capture's debug-only settings struct tail (`0x6060-0x60BF`) is what completes the struct.

## Props

| Prop      | Meaning                             |
| --------- | ----------------------------------- |
| `archive` | The open `DebugArchive` (required). |

## Usage

The radio page mounts it as the page-level **Settings** tab (the descriptor's `Settings`), after Memory. Without an archive it shows a No capture alert.

## Behaviour

Selection is `selectOpenGd77Settings` (`integrations/radio-io/radios/opengd77/debugSettings.ts`): the model must be identified from FirmwareInfo and match the archive, otherwise the tab says why and the Hex tab still shows the bytes. The firmware settings (59 members at flash `0x604B`) are decoded only after the magic `0x4780` is checked; a wrong magic is refused with the value found and no field is named, and a missing magic reads "not captured". Each member shows its address, raw bytes, decoded value, meaning, confidence (traced, partly), whether OpenGD77 reads it ("unused (no reader)" otherwise) and the source evidence. A member not wholly in the capture reads "Not captured" and one partly in it reads "Partly captured"; nothing is gap-filled. A current capture holds the whole struct (span 0 plus the `settings-gap` region); an older archive without that region holds only 21 of the member bytes and the rest reads Not captured. The data is labelled "Flash copy as of the last power-off or CPS save" (DM-1701) or "Backup copy; the live copy is in backup SRAM" (MD-9600). Below it, the codeplug device info (`0x80`) and general settings (`0xE0`) show the band limits, callsign and DMR ID where captured, and every field OpenGD77 never reads as unused (no reader).

## Related

[OpenGd77Memory](OpenGd77Memory.md), [DM-1701 settings](../../../../../docs/reference/radios/baofeng/dm-1701/settings.md), [MD-9600 settings](../../../../../docs/reference/radios/tyt/md-9600/settings.md)
