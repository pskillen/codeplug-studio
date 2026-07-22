# NeonPlug radio info, settings, and deferred entities

Wire shapes that are **mostly lossy** for Studio’s first NeonPlug milestones.

**Ground truth:** [codeplugExport.ts `CodeplugData`](https://github.com/infamy/NeonPlug/blob/main/src/services/codeplugExport.ts), [radio.ts `RadioInfo`](https://github.com/infamy/NeonPlug/blob/main/src/types/radio.ts), [RadioSettings.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/RadioSettings.ts)

## `radioInfo`

| Field             | Type    | Notes                                              |
| ----------------- | ------- | -------------------------------------------------- |
| `model`           | string  | e.g. `"DP570UV"`, `"UV5R-Mini"` — pathway selector |
| `firmware`        | string  |                                                    |
| `buildDate`       | string  |                                                    |
| `dspVersion` etc. | string? | Optional version strings                           |
| `maxContacts`     | number? |                                                    |
| `memoryLayout`    | object? | Config address range (DM32 / UV5R radio-read)      |
| `vframes`         | —       | In-memory Map; not JSON-friendly — omit on disk    |

### Studio guidance

| Direction | Behaviour                                                                 |
| --------- | ------------------------------------------------------------------------- |
| Export    | Set `model` (and minimal stubs) from the selected NeonPlug profile        |
| Import    | Use `model` to choose `neonplug-dm32uv` vs `neonplug-uv5rmini` when known |

## `radioSettings`

Large DM32-oriented settings bag (display, GPS, buttons, APRS position, embedded VFO channels, menu flags, …). Includes nested `vfoA` / `vfoB` as full [Channel](channels.md) objects and optional `radioSpecific` bag for other radios.

**UV5R-Mini:** radio-read donors typically have `radioSettings: { radioSpecific: { … } }` only (no shallow DM32 leaves). Build → NeonPlug settings decodes those leaves into labelled sections; see [radios/uv5rmini.md](radios/uv5rmini.md). DM32 settings UI continues to show shallow leaf keys only.

| Studio guidance | **Omit** (`null`) on **greenfield** export. On **merge-into-base**, retain the donor bag opaque at the export boundary — do not stash into the library — then **overwrite the APRS (+ related GPS) leaf fields** from `Library.aprsConfiguration` when present ([aprs.md](aprs.md), [#559](https://github.com/pskillen/codeplug-studio/issues/559)). Unmodelled keys (e.g. `aprsRepeaterActiveDelay`, VFOs, menu flags) stay from the donor. |

## Deferred arrays / objects

| Key                      | Ground truth                                                                                                         | Greenfield | Merge-into-base | Import                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------- | --------------- | ------------------------------------ |
| `messages`               | Quick text messages                                                                                                  | `[]`       | Retain donor    | Skip / lossy                         |
| `digitalEmergencies`     | [DigitalEmergency.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/DigitalEmergency.ts)                   | `[]`       | Retain donor    | Skip                                 |
| `digitalEmergencyConfig` | placeholder object                                                                                                   | `null`     | Retain donor    | Skip                                 |
| `analogEmergencies`      | Analog emergency systems                                                                                             | `[]`       | Retain donor    | Skip                                 |
| `encryptionKeys`         | [EncryptionKey.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/EncryptionKey.ts) — includes key material | `[]`       | Retain donor    | **Do not** persist keys into library |

## Loss table (operator-facing summary)

| NeonPlug content                    | After **greenfield** Studio export  | After **merge-into-base** export                                                   |
| ----------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| Channels (modelled RF fields)       | Studio projection                   | Studio projection (full replace)                                                   |
| Zones / scan / contacts / RX groups | Filled on DM32UV (#540); UV5R empty | Studio projection                                                                  |
| Channel contact / RX / scan indexes | Wired on DM32UV (#540); `0` on UV5R | From Studio projection                                                             |
| Operator `radioIds`                 | Empty                               | **Retained** from donor                                                            |
| Radio settings / VFOs               | Lost                                | **Retained** from donor; **APRS globals patched** from Studio ([aprs.md](aprs.md)) |

| Emergencies / messages / quick contacts | Lost | **Retained** from donor |
| Encryption keys | Lost (intentional on greenfield) | Opaque retain from donor (not library) |
| Unknown channel bitfields | Lost (defaults on export) | Lost (Studio channels overwrite) |
| Scan CTC / hang / priority | Defaults only (lossy) | Defaults on Studio scan lists |

Merge policy detail: [merge.md](merge.md). Document any additional loss discovered while implementing [#541](https://github.com/pskillen/codeplug-studio/issues/541)–[#543](https://github.com/pskillen/codeplug-studio/issues/543) here.
