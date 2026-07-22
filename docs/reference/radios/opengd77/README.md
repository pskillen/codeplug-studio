# OpenGD77 / OpenUV380 — binary memory & protocol

Tier-3 reference for **direct radio read/write** of firmware that speaks the OpenGD77 USB serial protocol: EEPROM/FLASH image regions, record layouts, and handshake notes.

This is **not** the OpenGD77 CPS CSV interchange format. Studio’s shipped file adapters use CSV; binary memory is a separate wire world for future Web Serial adapters ([#624](https://github.com/pskillen/codeplug-studio/issues/624), [#625](https://github.com/pskillen/codeplug-studio/issues/625)).

> **CPS CSV wire ≠ binary memory layout.** Column names, name-based FKs, and ZIP packaging live under [export-formats/opengd77](../../export-formats/opengd77/README.md). Offsets, banks, and `C`/`R`/`W`/`X` framing live **here**.

**Product hub:** [radio-read-write](../../../features/radio-read-write/README.md) · **Tracking:** [#623](https://github.com/pskillen/codeplug-studio/issues/623) (parent [#594](https://github.com/pskillen/codeplug-studio/issues/594))

## Protocol groups

qdmr groups radios by firmware info `radioType` into two protocol variants that share **record layouts** but differ in **image banks** and **write type byte**:

| Protocol group             | Write type | Image model                                             | Studio first targets                                                         |
| -------------------------- | ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **OpenGD77** (GD-77 class) | `'W'`      | Split EEPROM + FLASH                                    | Related baseline (not first Studio adapter)                                  |
| **OpenUV380**              | `'X'`      | Codeplug regions in **FLASH** (remapped high addresses) | [DM-1701](../baofeng/dm-1701/README.md), [MD-9600](../tyt/md-9600/README.md) |

### `radioType` codes (FirmwareInfo)

| Code  | Radio               |
| ----- | ------------------- |
| `00h` | Radioddity GD-77    |
| `01h` | Radioddity GD-77S   |
| `02h` | Baofeng DM-1801     |
| `03h` | Radioddity RD-5R    |
| `04h` | Baofeng DM-1801A    |
| `05h` | TYT MD-9600         |
| `06h` | TYT MD-UV390        |
| `07h` | TYT MD-380          |
| `08h` | Baofeng DM-1701     |
| `09h` | TYT MD-2017         |
| `0ah` | Baofeng DM-1701 RGB |

UV380-class for Studio adapters: `05h`, `08h`, `0ah` (plus other UV380 types not yet in Studio radio homes).

## Documentation map

| Doc                                                | Contents                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| [memory-layout.md](memory-layout.md)               | Image banks, region bases, channel-bank geometry, OpenUV380 vs GD-77 remapping |
| [channel-record.md](channel-record.md)             | Channel element (`0x38`) field offsets and enums                               |
| [contacts-zones-lists.md](contacts-zones-lists.md) | DMR/DTMF contacts, zones, RX group lists; scan-list note                       |
| [settings-aprs.md](settings-aprs.md)               | General/boot/APRS/additional-settings offsets                                  |
| [protocol.md](protocol.md)                         | USB VID/PID, `C`/`R`/`W`/`X`, flash sector write, FirmwareInfo                 |
| [fixtures.md](fixtures.md)                         | How to capture dumps for tests without committing personal codeplugs           |

## Radio homes (caps / power)

Binary maps are shared; per-radio limits and P-ladders stay in model homes:

| Radio                   | Path                                            |
| ----------------------- | ----------------------------------------------- |
| Baofeng DM-1701 / RT-84 | [baofeng/dm-1701](../baofeng/dm-1701/README.md) |
| TYT MD-9600 / RT-90     | [tyt/md-9600](../tyt/md-9600/README.md)         |

## Ground truth (cite; do not copy)

qdmr is **GPL-3**. Extract **facts** (addresses, sizes, enums) into these docs. Do **not** paste GPL sources into Studio.

| Source                                                                    | Role                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------- |
| [qdmr](https://github.com/hmatuschek/qdmr) `lib/opengd77base_codeplug.hh` | Shared record layouts (channels, contacts, zones, …)      |
| qdmr `lib/opengd77_codeplug.hh` / `.cc`                                   | GD-77-class region bases + registered image spans         |
| qdmr `lib/openuv380_codeplug.hh` / `.cc`                                  | OpenUV380 region bases (DM-1701 / MD-9600 path)           |
| qdmr `lib/opengd77_interface.hh` / `.cc`                                  | USB protocol, variants, FirmwareInfo                      |
| qdmr `lib/opengd77_limits.*`                                              | Cardinality / ignored features (e.g. scan lists)          |
| OpenGD77 project / CPS docs                                               | Firmware behaviour context                                |
| Studio [export-formats/opengd77](../../export-formats/opengd77/README.md) | Naming cross-checks for CSV only — **not** binary offsets |

Prefer qdmr `Offset` / `Limit` / `size()` constants over older Doxygen region narratives when they disagree.

## Attribution

Protocol lineage credit: `/attributions` entry `qdmr` (see attributions lib). Planned `RadioDescriptor.attributionIds` for OpenGD77 adapters should include `qdmr`.

## Planned Studio modules

`src/integrations/radio-io/radios/` — per-model adapters after transport [#615](https://github.com/pskillen/codeplug-studio/issues/615) and kit [#616](https://github.com/pskillen/codeplug-studio/issues/616). This ticket ships **docs only**.

## Related

- [radios index](../README.md)
- Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · memory RE [#623](https://github.com/pskillen/codeplug-studio/issues/623)
