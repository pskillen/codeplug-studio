# AT-D890UV — power ladder

Studio stores ordinary power settings from 0 through 100 and uses 101 for Above High. The value `null` means Radio default. See the [native YAML power field](../../../export-formats/native-yaml/README.md#channel).

Anytone CPS CSV export and Web Serial writes share the same AT-D890UV power mapping. The codec decodes the serial bits to the Studio values shown below. CSV label lookup uses the same values.

| CPS label | Serial bits | Decoded Studio value | Studio values on write   | Approx. power     |
| --------- | ----------- | -------------------- | ------------------------ | ----------------- |
| `Low`     | `0`         | 25                   | 0 to below 37.5          | 0.2 W             |
| `Mid`     | `1`         | 50                   | 37.5 to below 62.5       | 2.5 W             |
| `High`    | `2`         | 100                  | 62.5 through 100, `null` | 5 W               |
| `Turbo`   | `3`         | 101                  | 101                      | 7 W VHF / 6 W UHF |

The 37.5 and 62.5 cutoffs preserve the original CSV boundaries, with ties going to the higher setting. Previously saved values of 100 now write High. Select Above High to write Turbo. Studio uses the stored values to select a discrete tier with the approximate wattage shown above. [AT-D890UV CPS enum verification](https://github.com/pskillen/codeplug-studio/issues/357)

## Related

- [capabilities.md](capabilities.md) · [limits.md](limits.md)
- Adapter profile: [anytone profiles.md](../../../export-formats/anytone/profiles.md) (`anytone-at-d890uv`)
- Shared ladder and selector in [`power.ts`](../../../../../src/core/radios/anytone/at-d890uv/power.ts)
