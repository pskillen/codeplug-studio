# DM-1701 — limits

OpenGD77 / G4EML CPS caps for this hardware. Adapters warn or truncate at the **export boundary** — library CRUD stays unlimited.

| Constraint           | Value                   | Notes                                                |
| -------------------- | ----------------------- | ---------------------------------------------------- |
| Max channels         | **1023**                | `Channel Number` unique integer 1–1023; gaps allowed |
| Zone members         | **80**                  | `Channel1`…`Channel80`                               |
| TG list members      | **32**                  | `Contact1`…`Contact32`                               |
| Contacts             | ~100+                   | CPS / operator practice; no hard app limit today     |
| Channel name display | **~16** chars           | Longer names may truncate on radio LCD               |
| TOT range            | **0–495**, step **15**  | `0` = off (G4EML CPS)                                |
| Colour code          | **0–15**                | Digital channels                                     |
| Append CSV renumber  | Ignores channel numbers | Append mode compacts and renumbers sequentially      |

## Adapter application

| Adapter                  | Behaviour when over limit                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenGD77 `opengd77-1701` | `cps-verify` enforces cardinality and name-length caps; see [file-format.md — Wire verification](../../../export-formats/opengd77/file-format.md#wire-verification) |

## Related

- [capabilities.md](capabilities.md) · [power.md](power.md)
