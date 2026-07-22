# Scan inclusion (internal model)

Tier-2 reference for how Codeplug Studio models **channel scan participation** in the library and how it resolves at export.

Wire column mapping per format: [CHIRP `Skip`](chirp/channels.md), [OpenGD77 `All Skip`](opengd77/channels.md), [NeonPlug `scanAdd`](neonplug/channels.md). Feature hub: [library CRUD](../features/library/README.md).

## Library field

`Channel.scanInclusion` — tri-state, vendor-neutral:

| Value        | Operator meaning                                               |
| ------------ | -------------------------------------------------------------- |
| `default`    | Defer to the **format build** export setting at serialise time |
| `skip`       | Always exclude from scan on wire                               |
| `alwaysScan` | Always include on scan wire                                    |

Replaces legacy boolean `scanSkip` (schema v8). Import migration: `true` → `skip`; `false` → `default`.

## Export resolution order

1. **Build per-channel override** — `BuildEntityOverride.scanInclusion` on `channelOverrides` when set (flat-memory / per-channel scan flag builds)
2. **Library** — `Channel.scanInclusion`
3. When the effective value is still `default`:
   1. `FormatBuild.exportSettings.defaultScanInclusion` (`skip` \| `scan`) when set
   2. Format adapter `defaultExportSettings.defaultScanInclusion`
   3. Fallback `scan`

| Format   | Adapter default when build omits override |
| -------- | ----------------------------------------- |
| OpenGD77 | `scan`                                    |
| DM32     | `scan`                                    |
| CHIRP    | `skip`                                    |

Implementation: `src/core/import-export/scanInclusion/resolve.ts` (`resolveChannelScanInclusionForExport`).

## Orthogonal concepts

| Field                                             | Layer                                 | Concern                                                                                                             |
| ------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Zone-derived scan membership cascade              | Library / member / build / projection | See [zone-behavioural-defaults.md](zone-behavioural-defaults.md)                                                    |
| `BuildEntityOverride.scanInclusion`               | Build (`channelOverrides`)            | Per-channel Skip projection for flat-memory builds ([#589](https://github.com/pskillen/codeplug-studio/issues/589)) |
| `FormatBuild.exportSettings.defaultScanInclusion` | Build                                 | Default for effective `scanInclusion: default`                                                                      |
| `FlatMemoryLayout.scanFlags`                      | Build layout                          | **Deprecated** — do not use; overrides live on `channelOverrides`                                                   |

## UI

- Channel editor: `ScanInclusionSegment` (`Default` / `Skip scan` / `Always scan`) — **library** field
- Flat-memory **Scan list** (`/builds/:id/scan-list`) and channel wire-preview modal: same segment — **build** `channelOverrides.scanInclusion` (does not rewrite the library)
- Build export panel: `DefaultScanInclusionSegment` (`Scan` / `Skip`) for channels still on Default after override + library resolve

## Related

- [#203](https://github.com/pskillen/codeplug-studio/issues/203) · [#589](https://github.com/pskillen/codeplug-studio/issues/589)
- [Zone-derived scan lists](zone-derived-scan-lists.md)
- [Adding a new format — export settings](../features/import-export/adding-a-new-format.md)
