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
| `memoryLayout`    | object? | DM32 config address range                          |
| `vframes`         | —       | In-memory Map; not JSON-friendly — omit on disk    |

### Studio guidance

| Direction | Behaviour                                                                 |
| --------- | ------------------------------------------------------------------------- |
| Export    | Set `model` (and minimal stubs) from the selected NeonPlug profile        |
| Import    | Use `model` to choose `neonplug-dm32uv` vs `neonplug-uv5rmini` when known |

## `radioSettings`

Large DM32-oriented settings bag (display, GPS, buttons, APRS position, embedded VFO channels, menu flags, …). Includes nested `vfoA` / `vfoB` as full [Channel](channels.md) objects and optional `radioSpecific` bag for other radios.

| Studio guidance | **Omit** (`null`) on M1 export unless a typed Studio settings model exists. Do not stash the bag for round-trip. |

## Deferred arrays / objects

| Key                       | Ground truth                                                                 | M1 export | Import |
| ------------------------- | ---------------------------------------------------------------------------- | --------- | ------ |
| `messages`                | Quick text messages                                                          | `[]`      | Skip / lossy |
| `digitalEmergencies`      | [DigitalEmergency.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/DigitalEmergency.ts) | `[]` | Skip |
| `digitalEmergencyConfig`  | placeholder object                                                           | `null`    | Skip |
| `analogEmergencies`       | Analog emergency systems                                                     | `[]`      | Skip |
| `encryptionKeys`          | [EncryptionKey.ts](https://github.com/infamy/NeonPlug/blob/main/src/models/EncryptionKey.ts) — includes key material | `[]` | **Do not** persist keys into library |

## Loss table (operator-facing summary)

| NeonPlug content           | Re-import after Studio export (planned)      |
| -------------------------- | -------------------------------------------- |
| Channels / zones / scan / contacts / RX groups | Intended fidelity within modelled fields |
| Radio settings / VFOs      | Lost                                         |
| Emergencies                | Lost                                         |
| Encryption keys            | Lost (intentional)                           |
| Quick contacts `rawData`   | Lost                                         |
| Unknown channel bitfields  | Lost (defaults on export)                    |

Document any additional loss discovered while implementing [#539](https://github.com/pskillen/codeplug-studio/issues/539)–[#543](https://github.com/pskillen/codeplug-studio/issues/543) here.
