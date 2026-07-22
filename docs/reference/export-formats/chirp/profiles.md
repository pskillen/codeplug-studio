# CHIRP Studio profiles

Index of Studio `profileId` values for the CHIRP CSV adapter → radio homes under [`docs/reference/radios/`](../../radios/). Caps, power ladders, and RF facts live in the radio home; this page is the adapter-side map (filename conventions, `cps-verify` ids).

Generic column semantics: [README.md](README.md) · [channels.md](channels.md).

| Profile id | Radio | Path | Notes |
| --- | --- | --- | --- |
| `chirp-uv5r` | Baofeng UV-5R Mini | [../../radios/baofeng/uv-5r-mini/README.md](../../radios/baofeng/uv-5r-mini/README.md) | Filename `Baofeng_UV-5R Mini_{YYYYMMDD}.csv`; `cps-verify` `chirp-uv5r` |
| `chirp-uv21` | Baofeng UV-21Pro V2 | [../../radios/baofeng/uv-21-pro-v2/README.md](../../radios/baofeng/uv-21-pro-v2/README.md) | Filename `Baofeng_UV-21ProV2_{YYYYMMDD}.csv`; `cps-verify` `chirp-uv21` |
| `chirp-rt95` | Retevis RT95 VOX | [../../radios/retevis/rt95/README.md](../../radios/retevis/rt95/README.md) | Filename `Retevis_RT95 VOX_{YYYYMMDD}.csv`; `cps-verify` `chirp-rt95` |

Code: [`profiles.ts`](../../../../src/core/import-export/formats/chirp/profiles.ts). Wire checklist: [enum-verification.md](enum-verification.md).
