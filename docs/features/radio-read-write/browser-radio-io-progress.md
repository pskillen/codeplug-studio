# Browser radio I/O — progress

**Epic:** [#594](https://github.com/pskillen/codeplug-studio/issues/594) (under [#298](https://github.com/pskillen/codeplug-studio/issues/298) → [#495](https://github.com/pskillen/codeplug-studio/issues/495))  
**Constitution:** DESIGN.md allows intentional browser WebSerial radio I/O with attribution (see [#595](https://github.com/pskillen/codeplug-studio/issues/595)).  
**Hub:** [radio-read-write/README.md](README.md)

## Status

| Milestone | Status | Notes |
| --- | --- | --- |
| Milestone 1 — CHIRP CSV fidelity | Complete (feature) | UV-5R / UV-21 / RT95 profiles under [#504](https://github.com/pskillen/codeplug-studio/issues/504) |
| Milestone 2 — WebSerial direct read/write | Architecture spike | [#603](https://github.com/pskillen/codeplug-studio/issues/603) — docs only until kit tickets land |

## Shipped (foundation)

| Item | Ticket / PR | Notes |
| --- | --- | --- |
| DESIGN.md non-goal → intentional WebSerial | [#595](https://github.com/pskillen/codeplug-studio/issues/595) | Attribution requirement |
| Attributions stubs (CHIRP + NeonPlug) | [#597](https://github.com/pskillen/codeplug-studio/issues/597) | `AttributionsPage` / attributions lib |
| Progress docs under `radio-read-write/` | [#603](https://github.com/pskillen/codeplug-studio/issues/603) | Moved from `import-export/` |

## Next

1. Finish architecture spike [#603](https://github.com/pskillen/codeplug-studio/issues/603) — protocol kit boundaries + child tickets.
2. Implement transport + kit + UV-5R Mini path (child tickets under #594).
3. Wire firmware gating via supported catalog [#613](https://github.com/pskillen/codeplug-studio/issues/613) when write ships.
4. In-flow attribution chrome with first write UI ([#597](https://github.com/pskillen/codeplug-studio/issues/597)).

## Related

- [browser-radio-io-outstanding.md](browser-radio-io-outstanding.md)
- [CHIRP feature hub](../import-export/chirp/README.md)
- NeonPlug reference: `NeonPlug/src/radios/`
- CHIRP drivers: workspace `chirp/chirp/drivers/`
