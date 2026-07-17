# Wire preview UI rework (#349) — outstanding

Debt and follow-ups discovered during execution — not scheduled plan slices.

| Item                                                                                   | Notes                                                                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `WirePreviewTable` test-only                                                           | ~~Legacy inline table~~ — deleted in #460; tests moved to bulk-edit / override modal / `ZoneScanRowHeader` |
| Expanded channel skip ([#351](https://github.com/pskillen/codeplug-studio/issues/351)) | Skip on m×n / multi-mode / RX fan-out row applies to parent channel — all expansions skipped               |
| Manual QA matrix                                                                       | Operator smoke on 50+ channel fixture before merge — noted in PR                                           |

## Closed ([#381](https://github.com/pskillen/codeplug-studio/issues/381))

- ~~List virtualisation~~ — `WirePreviewDataTable` inherits virtual `DataTable`; see [datatable-virtualization-progress.md](../app-shell/datatable-virtualization-progress.md)
