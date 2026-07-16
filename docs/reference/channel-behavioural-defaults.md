# Channel behavioural defaults (internal model)

Tier-2 reference for how Codeplug Studio models **library-wide channel behavioural defaults**, per-channel overrides, and per-build export overrides — and how they resolve before CPS export.

Format wire mapping for each field is deferred to per-format tickets ([#422](https://github.com/pskillen/codeplug-studio/issues/422)–[#425](https://github.com/pskillen/codeplug-studio/issues/425)). Feature hub: [library](../features/library/README.md).

## Cascade layers

Precedence (later wins when set):

1. **Library** — `Library.channelDefaults` / `ProjectMeta.channelDefaults` (IndexedDB)
2. **Channel** — per-channel override fields (`default` defers to library + build)
3. **Build** — `FormatBuild.exportSettings` optional defaults

```text
Library.channelDefaults
  → Channel override (or `default`)
  → Build.exportSettings override (when set)
  → resolveEffective*()
  → export serialiser / resolution summary UI
```

Implementation: `src/core/import-export/channelBehaviourDefaults/resolve.ts`.

## Library defaults

`ChannelBehaviourDefaults` on `Library.channelDefaults` (required; factory-filled):

| Field               | Type                         | Factory default    |
| ------------------- | ---------------------------- | ------------------ |
| `forbidTransmit`    | `boolean`                    | `false` (allow TX) |
| `txPermit`          | `permitAlways` \| `busyLock` | `permitAlways`     |
| `sendTalkerAlias`   | `on` \| `off`                | `on`               |
| `analogSquelchMode` | `carrier` \| `tone`          | `carrier`          |

Native YAML: `library.channelDefaults` and mirrored `project.channelDefaults`. Schema **v18**.

## Channel overrides

| Field               | Override type                             | `default` meaning |
| ------------------- | ----------------------------------------- | ----------------- |
| `forbidTransmit`    | `default` \| `allow` \| `forbid`          | Use cascade       |
| `txPermit`          | `default` \| `permitAlways` \| `busyLock` | Use cascade       |
| `sendTalkerAlias`   | `default` \| `on` \| `off`                | Use cascade       |
| `analogSquelchMode` | `default` \| `carrier` \| `tone`          | Use cascade       |

Legacy `forbidTransmit: boolean` on import migrates: `true` → `forbid`, `false` → `default`.

## Build export overrides

Optional effective values on `BuildExportSettings` (win over library + channel when set):

- `defaultForbidTransmit` — `allow` \| `forbid`
- `defaultTxPermit` — `permitAlways` \| `busyLock`
- `defaultSendTalkerAlias` — `on` \| `off`
- `defaultAnalogSquelchMode` — `carrier` \| `tone`

Passed to exporters via `CpsExportOptions.channelBehaviourContext` (`mergeExportOptions` + `assemble` library slice).

## Export status (shipped vs deferred)

| Field                 | Resolve helpers | CPS wire (format adapters)                            |
| --------------------- | --------------- | ----------------------------------------------------- |
| TX deny               | Shipped         | Shipped (DM32, OpenGD77, Anytone, CHIRP forbid paths) |
| Busy Lock / TX Permit | Shipped         | Deferred (#422–#425)                                  |
| Send Talker Alias     | Shipped         | Deferred                                              |
| Analog Squelch Mode   | Shipped         | Deferred                                              |

## Orthogonal: scan inclusion

[`scanInclusion`](scan-inclusion.md) uses channel → build → format only (**no library tier**). Do not merge scan inclusion into `channelDefaults`.

## UI

- **Channel defaults** — `/library/channels/defaults` (nested under Channels)
- **Channel editor** — Behaviour overrides per channel
- **Build export** — optional default override segments
- **Export resolution** — read-only audit of effective values + winning layer per build

## Related

- Epic [#388](https://github.com/pskillen/codeplug-studio/issues/388)
- [Adding a new format — behavioural defaults checklist](../features/import-export/adding-a-new-format.md)
- [Data model — schema v18](../features/data-model/README.md)
