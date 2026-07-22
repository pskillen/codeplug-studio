# CHIRP profile — `chirp-uv21`

Thin adapter stub. **Radio home (caps, power):** [Baofeng UV-21Pro V2](../../../../radios/baofeng/uv-21-pro-v2/README.md).

| | |
| --- | --- |
| **Profile id** | `chirp-uv21` |
| **Fixture** | `formats/chirp/__fixtures__/export/Baofeng_UV-21ProV2_20251129.csv` |
| **Filename convention** | `Baofeng_UV-21ProV2_{YYYYMMDD}.csv` |
| **Wire verification** | `cps-verify` profile `chirp-uv21` (memory-slot + name-length caps; LF / selective quoting / headers — [CHIRP README — Wire verification](../../README.md#wire-verification)) |

Column mapping: [channels.md](../channels.md). Caps match CHIRP `UV21ProV2` / UV17Pro — [enum-verification.md](../enum-verification.md).
