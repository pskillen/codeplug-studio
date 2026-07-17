# OpenGD77 CPS — Baofeng 1701 sample

| | |
| --- | --- |
| **CPS** | OpenGD77 CPS **R2025.03.23.1** |
| **Radio profile** | Baofeng DM-1701 / Retevis RT-84 |
| **Provenance** | Official CPS **File → CSV → Export to CSV**; copied unedited |
| **Tracking** | [#403](https://github.com/pskillen/codeplug-studio/issues/403) |

## Files

| File | Rows (approx.) | Notes |
| ---- | -------------: | ----- |
| `Channels.csv` | ~199 | Analogue + digital; power / squelch / APRS name samples |
| `Zones.csv` | ~15 | Zone = scan membership (`Channel1`…`Channel80`) |
| `Contacts.csv` | ~55 | Group contacts; `TS Override` present |
| `TG_Lists.csv` | ~24 | Up to 32 member slots |
| `APRS.csv` | 2 configs | Named APRS configs + channel FK via `Channels.APRS` |
| `DTMF.csv` | header only | Empty body in this export |

## Caveats

- Working operator codeplug — **not** exhaustive of every CPS enum / ladder step.
- Contains real UK repeater / talk-group names and operator layout choices; committed intentionally for wire elicitation (no redaction).
- Do not treat as a golden import/export fixture; synthetic fixtures stay under `test-data/` or `__fixtures__/`.

Wire column docs: [`docs/reference/opengd77/`](../../../docs/reference/opengd77/). Profile: [`baofeng-1701.md`](../../../docs/reference/opengd77/radios/baofeng-1701.md).
