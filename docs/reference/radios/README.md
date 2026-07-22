# Radio references

Tier-3 **radio** knowledge: memory limits, name lengths, feature/RF capabilities, power ladders, and (where known) clone memory layout / direct-write protocol notes.

Layout: `docs/reference/radios/<manufacturer>/<model>/`.

Export/import **adapter** wire tables live under [`docs/reference/export-formats/`](../export-formats/). Product behaviour for browser read/write: [radio-read-write hub](../../features/radio-read-write/README.md).

## Index

Migration under [#621](https://github.com/pskillen/codeplug-studio/issues/621). Nested adapter stubs remain under `export-formats/*/radios/` until later slices.

| Manufacturer / model | Path | Notes |
| --- | --- | --- |
| Baofeng UV-5R Mini | [baofeng/uv-5r-mini/](baofeng/uv-5r-mini/README.md) | Caps, power, PROGRAM+R/W stub; CHIRP + NeonPlug adapters |
| Baofeng UV-21Pro V2 | [baofeng/uv-21-pro-v2/](baofeng/uv-21-pro-v2/README.md) | Caps, power; CHIRP `chirp-uv21` |
| Baofeng DM-32UV | [baofeng/dm-32uv/](baofeng/dm-32uv/README.md) | Caps, power/squelch; DM32 + NeonPlug (`DP570UV`) |
| Baofeng DM-1701 / RT-84 | [baofeng/dm-1701/](baofeng/dm-1701/README.md) | Caps, power P-ladder; OpenGD77 |

## Related

- [radios-extract-progress.md](../radios-extract-progress.md)
- [export-formats/](../export-formats/README.md)
