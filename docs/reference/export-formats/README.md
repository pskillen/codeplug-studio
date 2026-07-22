# Export-format wire references

Tier-3 **adapter** wire tables for Studio’s import/export boundary. Each subdirectory is one adapter (`formatId` family): CPS CSV/JSON/ZIP packaging, column mapping, and verification — **not** radio hardware limits.

Radio cardinality, power ladders, RF capabilities, and memory layout live under [`docs/reference/radios/<manufacturer>/<model>/`](../radios/). Per-adapter [`profiles.md`](chirp/profiles.md) maps Studio `profileId` → radio home. Nested adapter `radios/` trees were removed under [#621](https://github.com/pskillen/codeplug-studio/issues/621).

| Adapter     | Path                                  | Notes                                                                  |
| ----------- | ------------------------------------- | ---------------------------------------------------------------------- |
| OpenGD77    | [opengd77/](opengd77/README.md)       | Generic wire; [profiles.md](opengd77/profiles.md) → radios             |
| CHIRP CSV   | [chirp/](chirp/README.md)             | Analogue FM/AM memory CSV; [profiles.md](chirp/profiles.md)            |
| DM32 CSV    | [dm32/](dm32/README.md)               | Baofeng DM-32UV CPS CSV; [profiles.md](dm32/profiles.md)               |
| Anytone     | [anytone/](anytone/README.md)         | AT-D890UV and related CPS CSV; [profiles.md](anytone/profiles.md)      |
| NeonPlug    | [neonplug/](neonplug/README.md)       | `.neonplug` ZIP / `codeplug.json`; [profiles.md](neonplug/profiles.md) |
| Native YAML | [native-yaml/](native-yaml/README.md) | Studio project interchange (not radio-capped)                          |

Domain-neutral (tier 2) docs stay at [`docs/reference/`](../) root. Remote directory APIs under [`docs/reference/remote-directories/`](../remote-directories/).
