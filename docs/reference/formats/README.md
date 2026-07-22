# Format wire references

Tier-3 CPS / interchange **wire** tables for Studio’s import/export adapters. Each subdirectory is one format family (adapter id / firmware family / manufacturer).

| Format      | Path                                  | Notes                                                          |
| ----------- | ------------------------------------- | -------------------------------------------------------------- |
| OpenGD77    | [opengd77/](opengd77/README.md)       | Generic wire + [per-radio profiles](opengd77/radios/README.md) |
| CHIRP CSV   | [chirp/](chirp/README.md)             | Analogue FM/AM memory CSV + [profiles](chirp/radios/README.md) |
| DM32 CSV    | [dm32/](dm32/README.md)               | Baofeng DM-32UV CPS CSV (same radio family as NeonPlug DM32UV) |
| Anytone     | [anytone/](anytone/README.md)         | AT-D890UV and related CPS CSV                                  |
| NeonPlug    | [neonplug/](neonplug/README.md)       | `.neonplug` ZIP / `codeplug.json`                              |
| Native YAML | [native-yaml/](native-yaml/README.md) | Studio project interchange                                     |

Domain-neutral (tier 2) docs stay at [`docs/reference/`](../) root. Binary radio protocols (Web Serial) live under [`docs/reference/radios/`](../radios/). Remote directory APIs under [`docs/reference/remote-directories/`](../remote-directories/).
