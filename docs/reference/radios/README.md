# Radio references

Tier-3 **radio** knowledge: memory limits, name lengths, feature/RF capabilities, power ladders, and (where known) clone memory layout / direct-write protocol notes.

Layout: `docs/reference/radios/<manufacturer>/<model>/`.

Export/import **adapter** wire tables live under [`docs/reference/export-formats/`](../export-formats/). Product behaviour for browser read/write: [radio-read-write hub](../../features/radio-read-write/README.md).

## Index

| Manufacturer / model    | Path                                                    | Notes                                                                                                                                  |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Baofeng UV-5R Mini      | [baofeng/uv-5r-mini/](baofeng/uv-5r-mini/README.md)     | Caps, power, PROGRAM+R/W binary memory; CHIRP + NeonPlug                                                                               |
| Baofeng UV-21Pro V2     | [baofeng/uv-21-pro-v2/](baofeng/uv-21-pro-v2/README.md) | Caps, power; CHIRP `chirp-uv21`                                                                                                        |
| Baofeng DM-32UV         | [baofeng/dm-32uv/](baofeng/dm-32uv/README.md)           | Caps, power; V-frame + 4KB binary memory ([#637](https://github.com/pskillen/codeplug-studio/issues/637)); DM32 + NeonPlug (`DP570UV`) |
| Baofeng DM-1701 / RT-84 | [baofeng/dm-1701/](baofeng/dm-1701/README.md)           | Caps, power P-ladder; OpenGD77                                                                                                         |
| OpenGD77 / OpenUV380    | [opengd77/](opengd77/README.md)                         | Binary memory + serial protocol (CSV ≠ binary)                                                                                         |
| Retevis RT95 VOX        | [retevis/rt95/](retevis/rt95/README.md)                 | Caps, power; CHIRP `chirp-rt95`                                                                                                        |
| TYT MD-9600 / RT-90     | [tyt/md-9600/](tyt/md-9600/README.md)                   | Caps, power P-ladder (+W- not modelled); OpenGD77                                                                                      |
| Anytone AT-D890UV       | [anytone/at-d890uv/](anytone/at-d890uv/README.md)       | Caps, power, bank features; Anytone CPS                                                                                                |

Studio `profileId` → radio home maps live in per-adapter [`profiles.md`](../export-formats/chirp/profiles.md) under `export-formats/<adapter>/`.

## Related

- [radios-extract-progress.md](../radios-extract-progress.md)
- [export-formats/](../export-formats/README.md)
