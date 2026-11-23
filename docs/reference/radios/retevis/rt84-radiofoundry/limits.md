# RT84 (RadioFoundry) — limits

Board facts for a Retevis RT84 running RadioFoundry. Same RadioFoundry board image and codeplug layout as the DM-1701; board numbers are identical.

**Code:** `src/core/radios/retevis/rt84-radiofoundry/limits.ts` (`RT84_RADIOFOUNDRY_BOARD`).
**Upstream:** RadioFoundry `boards/dm1701` at `454a5b76`.

| Constraint             | Value                       | Notes                                            |
| ---------------------- | --------------------------- | ------------------------------------------------ |
| RF bands               | **136–174 and 400–480 MHz** | `BANDS_HZ`                                       |
| Power levels           | **5**                       | 100 mW, 500 mW, 1 W, 2.5 W, 5 W (`POWER_LABELS`) |
| ID database            | **520646**                  | Through image end `0xE00000`                     |
| Physical codeplug base | **0**                       |                                                  |
| Image end              | **0xE00000**                |                                                  |

Do not bake these into library CRUD.
