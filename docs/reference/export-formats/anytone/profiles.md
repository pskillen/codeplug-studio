# Anytone Studio profiles

Index of Studio `profileId` values for the Anytone CPS CSV adapter → radio homes under [`docs/reference/radios/`](../../radios/).

Generic wire: [README.md](README.md).

| Profile id          | Radio             | Path                                                                                 | Notes                                                                        |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `anytone-at-d890uv` | Anytone AT-D890UV | [../../radios/anytone/at-d890uv/README.md](../../radios/anytone/at-d890uv/README.md) | Provisional caps/power; sibling variants (D878, D578, …) out of scope for v1 |

The CSV profile and both Web Serial profiles use the same AT-D890UV power table. On export, 100 and `null` select `High`, while 101 selects `Turbo`. Studio offers Anytone CPS CSV for export only. [Shared AT-D890UV power table](../../radios/anytone/at-d890uv/power.md) · [Anytone CPS CSV reference](README.md)

The CSV profile is defined in [`profiles.ts`](../../../../src/core/import-export/formats/anytone/profiles.ts).
