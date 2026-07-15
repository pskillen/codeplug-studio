# DataTable virtualization (#381) — outstanding

Debt discovered during execution — not the plan backlog.

## Open

| Item                     | Notes                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| E2E perf benchmarks      | Optional Playwright scroll timing on 1000-row contacts fixture                                                      |
| Dynamic row heights      | Wire preview detail cells use fixed-height estimate (~56px with `onRowActivate`); remeasure if QA reports clipping  |
| Talk groups usage column | Still mixes `referenceCount` with separate RX-list filter; could split index keys if column semantics are clarified |

## Closed (shipped in #381)

- ~~Large contact list DOM cost~~ — virtual tbody in shared `DataTable`
- ~~Per-cell `findReferencesTo` on contacts~~ — `buildReferenceCountIndex`
