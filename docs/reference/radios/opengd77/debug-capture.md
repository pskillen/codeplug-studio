# OpenGD77 — debug capture archive

Tier-3 reference for the read-only capture made by the `/debug/radios/dm-1701/opengd77` and `/debug/radios/md-9600/opengd77` pages. Product behaviour: [radio-debug](../../../features/radio-debug/README.md). Frames the capture may send: [protocol.md — Debug capture allow-list](protocol.md#debug-capture-allow-list).

## What is read

1. Ping, then FirmwareInfo (`R` mem `09h`, 46 bytes). A radio type the selected profile does not accept stops the session here: nothing after FirmwareInfo is sent. The RadioFoundry probe runs next on connect; a `0x81` reply ends the read with `DebugWrongFirmwareError` (nothing read). When opted in, the capture may leave the serial port open on that error so the Debug page can hand off to a RadioFoundry read on the same transport.
2. Show CPS screen, then the calibration working copy: 16 reads of 32 bytes at `0x10000` (first after the identity and show CPS, so a refusal costs seconds, not the minutes of the spans; [calibration.md](calibration.md)), then the settings struct tail: 3 reads of 32 bytes at `0x6060` (`settings-gap`, flash `0x6060-0x60BF`, inspect-only, debug-only; it completes the settings struct `0x604B-0x60BE` with span 0). An older archive without it reads "not captured" for the struct tail.
3. The four registered FLASH spans in 32-byte reads ([memory-layout.md](memory-layout.md)).
4. Only when the operator ticks **Also read the User Database** (`includeUserDatabase`): the occupied User Database, the 12-byte header, then the packed entries ([user-database.md](user-database.md)). Unticked, no User Database frame is sent and the archive has no `user-database` region.
5. Close CPS screen.

No EEPROM, security-register (mode 10), write, restore or control command is sent. A failure or cancel produces no archive.

## Archive layout

A partial radio-backup zip (`coverage: known-map-regions`, every region `inspect-only`, never restorable). It reopens offline through the same archive reader as a live capture.

| Entry                                  | Content                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`                        | `radioModelId` is `DM-1701` or `MD-9600`; `descriptorLabel` is `OpenGD77 debug capture`; `firmware` is the FirmwareInfo revision when non-empty; no `serial`                                                                    |
| `regions/flash-span-0..3.bin`          | The registered FLASH spans at their absolute addresses and lengths                                                                                                                                                              |
| `regions/user-database.bin`            | Header plus packed entries, at the header address. **Packed, not contiguous flash**: entry segment 1 lives elsewhere in flash. Always at least 12 bytes, because the header is kept even when it is not a valid `Id` header     |
| `regions/calibration-working-copy.bin` | The 512 bytes returned at `0x10000`, `inspect-only`. **The OpenGD77 working copy, not stock factory calibration**; the firmware serves it from RAM. Archives made before this read lack the region, which reads as not captured |
| `debug/firmware-info.bin`              | The raw 46-byte FirmwareInfo reply                                                                                                                                                                                              |

## Identity provenance

Identity comes only from the FirmwareInfo sidecar: structure version, radio type, revision and build date (ASCII, as reported), SPI flash id, feature bits (bit 0 inverted display, bit 1 DMR ID database in `'n'` mode, bit 2 voice prompts loaded; other bits are shown as a hex value only). FirmwareInfo has **no serial**, and it cannot tell stock builds from forks or mods. A manifest `firmware` string without the sidecar is not identity.

Radio type is shared between look-alike models: `0x05` is both MD-9600 and RT-90, `0x08` both DM-1701 and RT-84, `0x0A` the RGB-display DM-1701 / RT-84. The page never claims which of the pair it is. The model on the page is the selected profile, not evidence.

## Per-model differences

| Profile         | Accepted radio types | Notes                                   |
| --------------- | -------------------- | --------------------------------------- |
| DM-1701 / RT-84 | `08h`, `0Ah`         | Power ladder per the DM-1701 radio home |
| MD-9600 / RT-90 | `05h`                | Power ladder per the MD-9600 radio home |

The FLASH part id is shown as reported (`0x4018` is the 16 MiB part both models boot on). Limits: [dm-1701](../baofeng/dm-1701/README.md), [md-9600](../tyt/md-9600/README.md).

## Comparison

The Compare tab (a second retained read of the same page) compares bytes only where the address space is known: a `flash-span-N` region whose address, length and path match the registered span (absolute FLASH address), and the `user-database` region at the packed header address (header, segment 0 and segment 1 packed together, not contiguous flash). Restorable (Backup ZIP) and inspect-only (debug read) spans both qualify. A User Database of different length counts the tail as missing bytes, never changed. Any other region is incomparable, and captures of different models are refused.

The decoded evidence diff reads only classified bytes and the raw FirmwareInfo sidecar (and, when the calibration region is valid and its local marker present, `Calibration / <row id>` decoded values, otherwise one Unavailable `Calibration` field): `Identity / Radio type`, `Revision`, `Build date`, `Flash ID`, `Features`, and `User Database / Header valid`, `Entry count (header)`, `Captured bytes`. An invalid or missing source gives Unavailable, never a guess. Decoded sidecar summaries are not evidence. FirmwareInfo has no serial, so there is no responding-unit verdict.

## Coverage

Coverage lists the registered spans as captured, partial (a shorter region than registered) or missing, the User Database as captured or not captured, the calibration working copy as captured or not captured in its own address space (not a flash span, never filling a gap), and the settings struct tail as captured or not captured (when captured it shrinks the unread gap that holds it). Everything between and outside the spans is _not read, unknown_. A capture is never a full flash image or a firmware dump. Regions with an unknown id, a non-`inspect-only` role or an unexpected path are listed as unclassified with the reason.
