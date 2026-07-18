# Zone behavioural defaults (internal model)

Tier-2 reference for how Codeplug Studio models **library-wide zone behavioural defaults**, per-member overrides, build export defaults, and per-exported-zone projection overrides — used for **zone-derived scan list membership**.

Feature hubs: [library](../features/library/README.md) · [zone grouping](../features/builds/zone-grouping.md). Orthogonal channel scan flags: [scan-inclusion.md](scan-inclusion.md).

## Cascade layers

Precedence (later wins when set):

1. **Library** — `Library.zoneDefaults` / `ProjectMeta.zoneDefaults`
2. **Member** — `ZoneMemberEntry.includeInScanList` (`default` \| `include` \| `skip`)
3. **Build** — `BuildExportSettings.defaultIncludeInZoneDerivedScanList?`
4. **Projection** — `ZoneGroupingZoneEntry.scanMemberInclusion[channelId]` on the **exported** zone

```text
Library.zoneDefaults.includeInZoneDerivedScanList
  → ZoneMemberEntry.includeInScanList (or default)
  → Build.exportSettings.defaultIncludeInZoneDerivedScanList (when set)
  → ZoneGroupingZoneEntry.scanMemberInclusion[channelId] (when set)
  → resolveEffectiveIncludeInZoneDerivedScanList()
  → zone-derived scan derive / Export resolution Zones tab
```

**Nested zones:** filters are not hierarchical. Parent projection skips do not rewrite the child library zone and do not imply skip when the child is exported separately. Flatten still walks nested membership for _which_ channels exist.

**Not on `BuildEntityOverride`:** that bag is keyed by a single library entity id (wire name / exclude / forceInclude). Zone-derived scan membership is a **(exported zone × channel)** pair, so the build layout entry holds the projection map.

## Library defaults

`ZoneBehaviourDefaults` on `Library.zoneDefaults` (required; factory-filled):

| Field                          | Type      | Factory default  |
| ------------------------------ | --------- | ---------------- |
| `includeInZoneDerivedScanList` | `boolean` | `true` (include) |

Native YAML: `library.zoneDefaults` and mirrored `project.zoneDefaults`. Schema **v19**.

## Member overrides

| Field               | Where                            | Override type                    | `default` meaning |
| ------------------- | -------------------------------- | -------------------------------- | ----------------- |
| `includeInScanList` | `ZoneMemberEntry` (channel kind) | `default` \| `include` \| `skip` | Use cascade       |

Legacy boolean: `false` → `skip`; omit / `true` → `default`.

## Build export overrides

Optional on `BuildExportSettings`:

- `defaultIncludeInZoneDerivedScanList` — `boolean` when set (wins over library + member)

Passed via `CpsExportOptions.zoneBehaviourContext` (`mergeExportOptions`).

## Per-exported-zone projection

On `ZoneGroupingZoneEntry`:

- `scanMemberInclusion?: Record<channelId, 'include' \| 'skip'>`

Build → Zones UI writes here only (does not call `putZone`). Clearing a skip removes the channel key (defers to earlier cascade layers).

## Orthogonal: channel scan inclusion

[`scanInclusion`](scan-inclusion.md) / `defaultScanInclusion` remain channel → build → format only. They still AND with zone-derived membership in derive ([zone-derived-scan-lists.md](zone-derived-scan-lists.md)).

## UI

- **Zone defaults** — `/library/zones/defaults` (nested under Zones). Operator copy frames the library boolean as default **include** vs **exclude** for zone-derived scan lists (field remains `includeInZoneDerivedScanList`).
- **Zone editor** — tri-state member control on `ZoneMemberEditor`
- **Build Zones** — per-exported-zone include switches (projection)
- **Build Export** — optional zone membership default override
- **Export resolution** — Channels / Zones tabs

## Related

- [#443](https://github.com/pskillen/codeplug-studio/issues/443) · epic [#388](https://github.com/pskillen/codeplug-studio/issues/388)
- [Adding a new format](../features/import-export/adding-a-new-format.md)
