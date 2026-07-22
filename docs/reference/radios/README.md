# Radio references

Tier-3 **radio** knowledge: memory limits, name lengths, feature/RF capabilities, power ladders, and (where known) clone memory layout / direct-write protocol notes.

Layout: `docs/reference/radios/<manufacturer>/<model>/`.

Export/import **adapter** wire tables live under [`docs/reference/export-formats/`](../export-formats/). Product behaviour for browser read/write: [radio-read-write hub](../../features/radio-read-write/README.md).

## Index

Migration under [#621](https://github.com/pskillen/codeplug-studio/issues/621) — manufacturer/model homes land in subsequent commits. Until then, transitional nested profiles remain under `export-formats/*/radios/` and the flat stub below.

| Manufacturer / model | Path | Notes |
| --- | --- | --- |
| Baofeng UV-5R Mini | [baofeng-uv5r-mini/](baofeng-uv5r-mini/README.md) | Transitional WebSerial stub; moving to `baofeng/uv-5r-mini/` |

## Related

- [radios-extract-progress.md](../radios-extract-progress.md)
- [export-formats/](../export-formats/README.md)
