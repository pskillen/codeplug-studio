# DM-32UV (RadioFoundry) — limits

Hardware caps for a Baofeng DM-32UV running RadioFoundry. The codeplug file is the [RadioFoundry codeplug](../../../export-formats/radiofoundry/README.md). These numbers are the radio target's source of truth. The exporter warns or truncates at the export boundary. Library CRUD stays unlimited. There is no Web Serial egress.

**Code:** `src/core/radios/baofeng/dm-32uv-radiofoundry/limits.ts` (`DM32UV_RADIOFOUNDRY_LIMITS`).

| Constraint            | Value    | Notes                                                        |
| --------------------- | -------- | ------------------------------------------------------------ |
| Channels              | **1024** |                                                              |
| Zones                 | **68**   |                                                              |
| Zone members          | **80**   |                                                              |
| Contacts              | **1024** | Talk groups and private contacts share this bank             |
| RX group lists        | **76**   |                                                              |
| RX group list members | **32**   |                                                              |
| Names                 | **16**   | Channel, zone, contact, and talk-group names                 |
| Radio name            | **8**    |                                                              |
| Radio DMR IDs         | **1**    | Maximum ID **16776415**                                      |
| Power levels          | **9**    | Watt values are unmeasured. Do not invent a watt ladder yet. |

Do not bake these into library CRUD.
