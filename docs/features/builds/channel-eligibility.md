# RF channel eligibility

**Tracking:** [#612](https://github.com/pskillen/codeplug-studio/issues/612) · [#744](https://github.com/pskillen/codeplug-studio/issues/744)

Operators should not have to guess which library channels their radio can use. Studio filters **build** channel lists and **export candidates** from shared per-radio RF tables — the library itself stays unlimited.

## Purpose

| Layer                                      | RF caps applied?                                  |
| ------------------------------------------ | ------------------------------------------------- |
| Library CRUD                               | No — all modes and frequencies allowed            |
| Radio Build lists / pickers                | Yes — via `channelEligibleForRadio` (including wire-preview **Channels** and zone member pickers) |
| `assemble` / CPS export / Web Serial Write | Yes — ineligible channels never reach serialisers |

Wire translation (NeonPlug no-TX sentinels, Anytone receive banks, CHIRP analogue-only rows, etc.) is unchanged. Eligibility **drops candidates** before adapters run; it does not rewrite channel fields or infer forbid-transmit from band tables.

## Gates

1. **Mode (always on):** the channel must have at least one `modeProfile` whose `mode` is in the radio target’s `supportedModes`.
2. **Frequency (default on):** when **Hide channels outside frequency range** is enabled on the build, the channel’s **RX** frequency (Hz → MHz) must fall in at least one configured range whose `modes` intersect the channel’s supported-mode profiles. Missing RX frequency counts as out of range. Overlapping bands: any matching range wins.

Per-radio tables live in `src/core/radio-targets/rfCapabilities.ts` and are mirrored on **Radio characteristics** (`/builds/:id/characteristics` → **RF bands and modes**). Tier-3 range tables: `docs/reference/radios/<mfr>/<model>/capabilities.md`.

## Export setting

| Field                               | Default     | Effect                                                             |
| ----------------------------------- | ----------- | ------------------------------------------------------------------ |
| `hideChannelsOutsideFrequencyRange` | `true` (on) | Hide out-of-band channels on build pages and omit them from export |

Toggle on **Export** (and flat-memory **Channels** / **Scan list** export settings). Persisted on `RadioBuild.exportSettings`; round-trips in native YAML.

When export skips channels, `assemble` adds a single grouped warning (count + names) — same path for CPS download and Web Serial Write.

## Toggle reconciliation (v1)

Changing the frequency hide toggle may surface channels that were previously filtered out. Studio does **not** fully reorder flat-memory slots or zone members automatically.

| Order state                                            | Behaviour                                            |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Matches library grouping                               | Zone member hints reset to the new eligible set      |
| Overridden (`orderOrSlot` or custom zone member order) | Existing order kept; newly eligible IDs **appended** |

A confirm dialog warns that slot/member order may need redoing.

## Code anchors

| Module                                                          | Role                                            |
| --------------------------------------------------------------- | ----------------------------------------------- |
| `src/core/radio-targets/rfCapabilities.ts`                      | Authoritative Hz/MHz tables per `radioTargetId` |
| `src/core/domain/channelEligibility.ts`                         | `channelEligibleForRadio`, warnings             |
| `src/core/domain/channelEligibilityReconcile.ts`                | Toggle reconciliation                           |
| `src/core/services/assemble.ts`                                 | Filters `assembleChannels`                      |
| `src/core/domain/exportOrderOrSlot.ts`                          | Flat-memory candidate sets                      |
| `src/app/components/builds/FrequencyRangeEligibilityFields.tsx` | Export toggle UI                                |
| `src/app/components/builds/RadioRfCapabilitiesSection.tsx`      | Characteristics display                         |

## Manual verify

1. **RT95 build** — AM/airband library channel hidden on Channels; FM in 136–174 / 400–490 visible.
2. **UV-5R Mini** — in-band AM (108–136 MHz) visible; DMR channel hidden (unsupported mode).
3. **DM-1701** — AM channel hidden; FM/DMR in 136–174 and 400–470 visible.
4. Turn off **Hide channels outside frequency range** — out-of-band FM appears on build lists; export shows eligibility warning.
5. **Radio characteristics** — bands/modes table matches the build’s `radioTargetId`.

## Related

- [builds hub](README.md)
- [cps-services.md](../import-export/cps-services.md) — `assemble` pipeline
- Execution log: [rf-channel-eligibility-progress.md](rf-channel-eligibility-progress.md)
