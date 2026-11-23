# MD-9600 (RadioFoundry) — limits

Board facts for TYT MD-9600 running RadioFoundry. Power names reflect upstream wattmeter readings on V1–V3 boards.

**Code:** `src/core/radios/tyt/md-9600-radiofoundry/limits.ts` (`MD9600_RADIOFOUNDRY_BOARD`).
**Upstream:** RadioFoundry `boards/md9600` at `454a5b76`.

| Constraint             | Value                       | Notes                                                                                  |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| RF bands               | **136–174 and 400–480 MHz** | `BANDS_HZ`                                                                             |
| Power levels           | **5**                       | VHF/UHF split labels in `POWER_LABELS` (250 mW VHF / 100 mW UHF … 50 W VHF / 45 W UHF) |
| ID database            | **520646**                  | Through image end `0xE00000`                                                           |
| Physical codeplug base | **0**                       |                                                                                        |
| Image end              | **0xE00000**                |                                                                                        |

Do not bake these into library CRUD.
