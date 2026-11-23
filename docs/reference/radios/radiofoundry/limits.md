# RadioFoundry firmware: limits

Limits every radio running RadioFoundry shares: they are fixed by the firmware's core codeplug, not by the board. The codeplug file is the [RadioFoundry codeplug](../../export-formats/radiofoundry/README.md). The exporter warns or truncates at the export boundary. Library CRUD stays unlimited.

**Code:** `src/core/radios/radiofoundry/limits.ts` (`RADIOFOUNDRY_LIMITS`).
**Upstream:** `core/codeplug/codeplug.h` in RadioFoundry at `454a5b76`.

| Constraint            | Value    | Notes                                            |
| --------------------- | -------- | ------------------------------------------------ |
| Channels              | **1024** |                                                  |
| Zones                 | **68**   |                                                  |
| Zone members          | **80**   |                                                  |
| Contacts              | **1024** | Talk groups and private contacts share this bank |
| RX group lists        | **76**   |                                                  |
| RX group list members | **32**   |                                                  |
| Names                 | **16**   | Channel, zone, contact, and talk-group names     |
| Radio name            | **8**    |                                                  |
| Radio DMR IDs         | **1**    | Maximum ID **16776415**                          |

## Per board

What differs between boards lives in one module per board (`RadioFoundryBoardLimits`): RF bands, power levels (how many the board drives; the [codeplug page](../../export-formats/radiofoundry/README.md) has the byte rule that spreads RadioFoundry's 10-step power byte over fewer levels), the DMR ID database size the cable write may send, the physical base of the codeplug image, and where the image ends. Each board also has a cable board object (base, VERSION names, group) and gets its descriptor from one factory.

- Baofeng DM-32UV: [limits.md](../baofeng/dm-32uv-radiofoundry/limits.md)
- Baofeng DM-1701: [limits.md](../baofeng/dm-1701-radiofoundry/limits.md)
- Retevis RT84: [limits.md](../retevis/rt84-radiofoundry/limits.md)
- TYT MD-9600: [limits.md](../tyt/md-9600-radiofoundry/limits.md)
- Retevis RT90: [limits.md](../retevis/rt90-radiofoundry/limits.md)

Firmware version and board names: [firmware.md](firmware.md). What a cable write sends and refuses: [cable-write.md](cable-write.md).

Do not bake these into library CRUD.
