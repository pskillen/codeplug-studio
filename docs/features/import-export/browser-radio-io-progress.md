# Browser radio I/O — progress

**Epic:** [#594](https://github.com/pskillen/codeplug-studio/issues/594) (under [#298](https://github.com/pskillen/codeplug-studio/issues/298))  
**Constitution:** DESIGN.md allows intentional browser WebSerial radio I/O with attribution (see PR for [#595](https://github.com/pskillen/codeplug-studio/issues/595)).  
**Prerequisite:** CHIRP CSV first-class for `chirp-uv5r` / `chirp-uv21` / `chirp-rt95` (Milestone 1 under [#504](https://github.com/pskillen/codeplug-studio/issues/504)).

## Status

| Milestone | Status | Notes |
| --- | --- | --- |
| Milestone 1 — CHIRP CSV fidelity | In flight / landing | Source-backed caps + enum-verification + cps-verify for three profiles |
| Milestone 2 — WebSerial direct read/write | **Not started** | Architecture spike only until CSV MVP closes |

## Shipped (foundation)

| Item | Ticket / PR | Notes |
| --- | --- | --- |
| DESIGN.md non-goal → intentional WebSerial | [#595](https://github.com/pskillen/codeplug-studio/issues/595) | Attribution requirement |
| Attributions stubs (CHIRP + NeonPlug) | [#597](https://github.com/pskillen/codeplug-studio/issues/597) | `AttributionsPage` / attributions lib |
| `cpsVersion` / `firmwareVersion` on builds | [#596](https://github.com/pskillen/codeplug-studio/issues/596) | Firmware gates future radio I/O |

## Next (do not implement product WebSerial yet)

1. Close Milestone 1 CSV criteria on #504 / #591 / #592.
2. Run architecture spike [#603](https://github.com/pskillen/codeplug-studio/issues/603) — document reusable protocol kit shape (session, framing, clone-image vs V-frame); **no product merge** of radio write until spike accepted.
3. First radio path likely UV-5R Mini (NeonPlug clone protocol) with in-flow attribution UI.

## Related

- [browser-radio-io-outstanding.md](browser-radio-io-outstanding.md)
- [CHIRP feature hub](chirp/README.md)
- NeonPlug reference: `NeonPlug/src/radios/`
- CHIRP drivers: workspace `chirp/drivers/`
