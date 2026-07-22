# NeonPlug Studio profiles

Index of Studio `profileId` values for the NeonPlug adapter → radio homes under [`docs/reference/radios/`](../../radios/). Caps and power live in the radio home; notes below are adapter-only (expected `CodeplugData` surface, NeonPlug upstream paths).

Generic wire: [README.md](README.md).

| Profile id | Radio | Path | Notes |
| --- | --- | --- | --- |
| `neonplug-uv5rmini` | Baofeng UV-5R Mini | [../../radios/baofeng/uv-5r-mini/README.md](../../radios/baofeng/uv-5r-mini/README.md) | Analogue channels; opaque `radioSpecific` settings bag (lossy); NeonPlug `src/radios/uv5rmini/` |
| `neonplug-dm32uv` | Baofeng DM-32UV | [../../radios/baofeng/dm-32uv/README.md](../../radios/baofeng/dm-32uv/README.md) | Full CodeplugData surface; numeric caps match `dm32-baofeng-dm32uv`; NeonPlug `src/radios/dm32uv/` |

**Deferred:** Yaesu FT-65 / FT-4 / FT-25 — NeonPlug supports them; no Studio pathway yet ([#536](https://github.com/pskillen/codeplug-studio/issues/536)).

Code: [`profiles.ts`](../../../../src/core/import-export/formats/neonplug/profiles.ts).
