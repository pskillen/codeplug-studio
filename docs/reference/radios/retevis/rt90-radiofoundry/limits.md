# RT90 (RadioFoundry) — limits

Board facts for Retevis RT90 running RadioFoundry. Same board image as MD-9600.

**Code:** `src/core/radios/retevis/rt90-radiofoundry/limits.ts` (`RT90_RADIOFOUNDRY_BOARD`).
**Upstream:** RadioFoundry `boards/md9600` at `454a5b76`.

| Constraint             | Value                       | Notes                                           |
| ---------------------- | --------------------------- | ----------------------------------------------- |
| RF bands               | **136–174 and 400–480 MHz** |                                                 |
| Power levels           | **5**                       | Same VHF/UHF ladder as MD-9600 (`POWER_LABELS`) |
| ID database            | **520646**                  |                                                 |
| Physical codeplug base | **0**                       |                                                 |
| Image end              | **0xE00000**                |                                                 |

Do not bake these into library CRUD.
