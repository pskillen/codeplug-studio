# Radio references

Tier-3 **radio** knowledge: memory limits, name lengths, feature/RF capabilities, power ladders, and (where known) clone memory layout / direct-write protocol notes.

Layout: `docs/reference/radios/<manufacturer>/<model>/`.

Export/import **adapter** wire tables live under [`docs/reference/export-formats/`](../export-formats/). Product behaviour for browser read/write: [radio-read-write hub](../../features/radio-read-write/README.md).

## Index

Migration under [#621](https://github.com/pskillen/codeplug-studio/issues/621). Nested adapter stubs remain under `export-formats/*/radios/` until later slices.

| Manufacturer / model | Path | Notes |
| --- | --- | --- |
| Baofeng UV-5R Mini | [baofeng/uv-5r-mini/](baofeng/uv-5r-mini/README.md) | Caps, power, PROGRAM+R/W stub; CHIRP + NeonPlug adapters |

## Related

- [radios-extract-progress.md](../radios-extract-progress.md)
- [export-formats/](../export-formats/README.md)
