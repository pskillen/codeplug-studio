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

What differs between boards lives in one module per board (`RadioFoundryBoardLimits`): RF bands, power steps, the DMR ID database size the cable write may send, the physical base of the codeplug image, and where the image ends.

- Baofeng DM-32UV: [limits.md](../baofeng/dm-32uv-radiofoundry/limits.md)

Do not bake these into library CRUD.
