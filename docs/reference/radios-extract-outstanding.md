# Radios extract — outstanding

Debt discovered while executing [#621](https://github.com/pskillen/codeplug-studio/issues/621). Scheduled plan slices stay in the Cursor plan — not listed here.

## Open

_(none)_ — slice 6 hub/path polish complete. Ready to retire this pair when [#621](https://github.com/pskillen/codeplug-studio/issues/621) closes (after slice 7 PR).

## Intentional non-fixes

| Item                                                                        | Notes                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/app/routes/builds/groupFormatBuilds.ts` keys `radio:baofeng-uv5r-mini` | Runtime grouping key, not a docs path — leave as-is            |
| `src/core/import-export/formats/`                                           | Adapter code tree — must not be rewritten to `export-formats/` |

## Related

- [radios-extract-progress.md](radios-extract-progress.md)
