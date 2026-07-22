# Radios extract — progress

**Tracking:** [#621](https://github.com/pskillen/codeplug-studio/issues/621) (under [#496](https://github.com/pskillen/codeplug-studio/issues/496))  
**Branch:** `621/pskil/radios-extract`

## Status

| Slice | Status | Notes |
| --- | --- | --- |
| 1 — Rename `formats/` → `export-formats/` | Done | Path rewrite + boundaries + radios hub scaffold |
| 2 — Extract `baofeng/uv-5r-mini` | Done | `radios/baofeng/uv-5r-mini/` + thin CHIRP/NeonPlug stubs |
| 3 — Extract remaining Baofeng radios | Done | `uv-21-pro-v2`, `dm-32uv`, `dm-1701` + thinned nested stubs |
| 4 — Extract Retevis / TYT / Anytone | Done | `retevis/rt95`, `tyt/md-9600`, `anytone/at-d890uv` + thinned stubs |
| 5 — Adapter `profiles.md` + delete nested `radios/` | Done | Per-adapter `profiles.md`; nested `radios/` removed |
| 6 — Hub / rule polish | Pending | |
| 7 — PR | Pending | |

## Shipped

| Item | Notes |
| --- | --- |
| `docs/reference/export-formats/` | Renamed from `formats/` |
| Progress / outstanding pair | This file + outstanding |
| documentation-boundaries tier-3 | `export-formats/` + `radios/<mfr>/<model>/` |
| `docs/reference/radios/baofeng/uv-5r-mini/` | Caps + power + PROGRAM+R/W stub; adapter stubs thinned |
| `docs/reference/radios/baofeng/uv-21-pro-v2/` | Caps + power; CHIRP stub thinned |
| `docs/reference/radios/baofeng/dm-32uv/` | Merged DM32 + NeonPlug caps/power/squelch; both stubs thinned |
| `docs/reference/radios/baofeng/dm-1701/` | OpenGD77 1701/RT-84 caps + P-ladder; stub thinned |
| `docs/reference/radios/retevis/rt95/` | CHIRP RT95 caps + power; stub thinned |
| `docs/reference/radios/tyt/md-9600/` | OpenGD77 MD-9600/RT-90 caps + P-ladder (+W- note); stub thinned |
| `docs/reference/radios/anytone/at-d890uv/` | Anytone AT-D890UV caps + power + features; stub thinned |

## Related

- [radios-extract-outstanding.md](radios-extract-outstanding.md)
- [radios/README.md](radios/README.md)
- [export-formats/README.md](export-formats/README.md)
