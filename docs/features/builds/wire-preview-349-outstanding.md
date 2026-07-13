# Wire preview UI rework (#349) — outstanding

Debt and follow-ups discovered during execution — not scheduled plan slices.

| Item                                                                                   | Notes                                                                                        |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `WirePreviewTable` test-only                                                           | Legacy inline table kept for zone-scan expand unit tests; migrate tests and delete component |
| Expanded channel skip ([#351](https://github.com/pskillen/codeplug-studio/issues/351)) | Skip on m×n / multi-mode / RX fan-out row applies to parent channel — all expansions skipped |
| List virtualisation                                                                    | Follow-up if modal split is insufficient on very large builds (500+ rows)                    |
| Manual QA matrix                                                                       | Operator smoke on 50+ channel fixture before merge — noted in PR                             |
