# Export-format wire references

Tier-3 **adapter** wire tables for Studio’s import/export boundary. Each subdirectory is one adapter (`formatId` family): CPS CSV/JSON/ZIP packaging, column mapping, and verification — **not** radio hardware limits.

Radio cardinality, power ladders, RF capabilities, and memory layout live under [`docs/reference/radios/<manufacturer>/<model>/`](../radios/). Nested `radios/` folders under adapters are being removed under [#621](https://github.com/pskillen/codeplug-studio/issues/621); use radio homes + per-adapter `profiles.md` (landing in later slices).

| Adapter | Path | Notes |
| --- | --- | --- |
| OpenGD77 | [opengd77/](opengd77/README.md) | Generic wire; radio profiles migrating to `radios/` |
| CHIRP CSV | [chirp/](chirp/README.md) | Analogue FM/AM memory CSV |
| DM32 CSV | [dm32/](dm32/README.md) | Baofeng DM-32UV CPS CSV |
| Anytone | [anytone/](anytone/README.md) | AT-D890UV and related CPS CSV |
| NeonPlug | [neonplug/](neonplug/README.md) | `.neonplug` ZIP / `codeplug.json` |
| Native YAML | [native-yaml/](native-yaml/README.md) | Studio project interchange (not radio-capped) |

Domain-neutral (tier 2) docs stay at [`docs/reference/`](../) root. Remote directory APIs under [`docs/reference/remote-directories/`](../remote-directories/).
