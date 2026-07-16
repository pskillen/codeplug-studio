# Channel behavioural defaults (internal model)

Tier-2 reference for how Codeplug Studio models **library-wide channel behavioural defaults**, per-channel overrides, and per-build export overrides — and how they resolve before CPS export.

Format wire mapping for each field is tracked per format ([#422](https://github.com/pskillen/codeplug-studio/issues/422)–[#425](https://github.com/pskillen/codeplug-studio/issues/425)). Feature hub: [library](../features/library/README.md).

## Cascade layers

Precedence (later wins when set):

1. **Library** — `Library.channelDefaults` / `ProjectMeta.channelDefaults` (IndexedDB)
2. **Channel** — per-channel override fields (`default` defers to library + build)
3. **Build** — `FormatBuild.exportSettings` optional defaults

```text
Library.channelDefaults
  → Channel / mode-profile override (or `default`)
  → Build.exportSettings override (when set)
  → resolveEffective*()
  → export serialiser / resolution summary UI
```

- TX deny and TX permit resolve against **channel** fields.
- Talker alias resolves against the **DMR mode profile**.
- Analog squelch mode resolves against each **analog mode profile**.

## Library defaults

`ChannelBehaviourDefaults` on `Library.channelDefaults` (required; factory-filled):

| Field               | Type                         | Factory default    |
| ------------------- | ---------------------------- | ------------------ |
| `forbidTransmit`    | `boolean`                    | `false` (allow TX) |
| `txPermit`          | `permitAlways` \| `busyLock` | `permitAlways`     |
| `sendTalkerAlias`   | `on` \| `off`                | `on`               |
| `analogSquelchMode` | `carrier` \| `tone`          | `carrier`          |

Native YAML: `library.channelDefaults` and mirrored `project.channelDefaults`. Schema **v18**.

## Channel / mode-profile overrides

| Field               | Where                      | Override type                             | `default` meaning |
| ------------------- | -------------------------- | ----------------------------------------- | ----------------- |
| `forbidTransmit`    | `Channel`                  | `default` \| `allow` \| `forbid`          | Use cascade       |
| `txPermit`          | `Channel`                  | `default` \| `permitAlways` \| `busyLock` | Use cascade       |
| `sendTalkerAlias`   | `ChannelModeProfileDMR`    | `default` \| `on` \| `off`                | Use cascade       |
| `analogSquelchMode` | `ChannelModeProfileAnalog` | `default` \| `carrier` \| `tone`          | Use cascade       |

Legacy `forbidTransmit: boolean` on import migrates: `true` → `forbid`, `false` → `default`.

Legacy channel-level `sendTalkerAlias` / `analogSquelchMode` migrate onto DMR / analog mode profiles at read time.

## Build export overrides

Optional effective values on `BuildExportSettings` (win over library + channel when set):

- `defaultForbidTransmit` — `allow` \| `forbid`
- `defaultTxPermit` — `permitAlways` \| `busyLock`
- `defaultSendTalkerAlias` — `on` \| `off`
- `defaultAnalogSquelchMode` — `carrier` \| `tone`

Passed to exporters via `CpsExportOptions.channelBehaviourContext` (`mergeExportOptions` + `assemble` library slice).

## Export status (shipped vs deferred)

| Field                 | Resolve helpers | CPS wire (format adapters)                                           |
| --------------------- | --------------- | -------------------------------------------------------------------- |
| TX deny               | Shipped         | Shipped (DM32, OpenGD77, Anytone, CHIRP forbid paths)                |
| Busy Lock / TX Permit | Shipped         | Shipped Anytone + DM32 `TX Admit`; export loss OpenGD77/CHIRP        |
| Send Talker Alias     | Shipped         | Shipped Anytone; export loss DM32/OpenGD77/CHIRP                     |
| Analog Squelch Mode   | Shipped         | Shipped Anytone + DM32 `RX Squelch Mode`; export loss OpenGD77/CHIRP |

## Orthogonal: scan inclusion

[`scanInclusion`](scan-inclusion.md) uses channel → build → format only (**no library tier**). Do not merge scan inclusion into `channelDefaults`.

## UI

- **Channel defaults** — `/library/channels/defaults` (nested under Channels)
- **Channel editor** — Frequencies tab (transmit, TX permit); Modes → DMR subtab (talker alias); Modes → analog subtab (squelch mode)
- **Build export** — optional default override segments
- **Export resolution** — read-only audit of effective values + winning layer per build

## Related

- Epic [#388](https://github.com/pskillen/codeplug-studio/issues/388)
- [Adding a new format — behavioural defaults checklist](../features/import-export/adding-a-new-format.md)
- [Data model — schema v18](../features/data-model/README.md)
