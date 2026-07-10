# IRTS Ireland repeater directory — outstanding

Debt discovered during [#273](https://github.com/pskillen/codeplug-studio/issues/273) execution — not the plan backlog.

## Known gaps (deferred)

- **Multi-mode richness** — IRTS HTML lists DMR + D-STAR + Fusion + analogue on one site; Anytone CSV flattens to one row per frequency/mode.
- **Chirp `DV` rows** — Chirp CSV marks some D-STAR sites as `DV`; not merged with Anytone DMR rows in v1.
- **Locator / coordinates** — Anytone CSV has no maidenhead or lat/lon; map stays empty until enrichment.
- **Northern Ireland overlap** — IRTS CSV is ROI-scoped (`EI*` / `EJ*`); NI `GB*` sites on the HTML page are excluded. UK ETCC policy is a separate ticket.
