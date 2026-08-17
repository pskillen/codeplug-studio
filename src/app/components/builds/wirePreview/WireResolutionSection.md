## Purpose

"Why is it this?" reading for one wire-preview row's export projection — absorbed from the
deleted `/builds/:id/export-resolution` About route (wire-preview rework phase 8,
ux-proposal.md §1). Lists each exported field next to the layer that decided its effective
value: library default, channel/zone/member override, build override, or (wire names only) a
row override / target constraint.

**Tracking:** [#1219](https://github.com/pskillen/codeplug-studio/issues/1219), closes
[#956](https://github.com/pskillen/codeplug-studio/issues/956)

## Props

| Prop              | Type                                       | Description                                                         |
| ----------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| `fields`          | `ResolutionFieldRow[]`                     | One row per exported field — label, effective value, deciding layer |
| `zoneDerivedScan` | `ZoneScanMemberResolutionRow[]` (optional) | Zone rows only — per-member zone-derived scan inclusion             |

Both row shapes come from `src/app/lib/wirePreviewResolution.ts`, which composes the existing
`resolve*WithLayer` cascades (`@core/import-export/channelBehaviourDefaults/resolve.ts`,
`@core/import-export/zoneBehaviourDefaults/resolve.ts`) plus wire-name layer attribution
derived from `WirePreviewRow.hasWireNameOverride` / `.remediation` — not a fifth stored layer.

## Usage

```tsx
<WireResolutionSection
  fields={channelWireResolutionRows(channel, row, build, library)}
/>

<WireResolutionSection
  fields={zoneWireResolutionRows(row)}
  zoneDerivedScan={zoneDerivedScanResolutionRows(zone, build, library, zoneGroupingLayout)}
/>
```

## Behaviour

- Channel rows: wire name, transmit, TX permit, talker alias (DMR profiles only), analog
  squelch (analog profiles only).
- Zone rows: wire name, plus a member-by-member zone-derived scan inclusion list when the zone
  is set to export as a scan list and the format/profile supports the trait (undefined
  otherwise — the caller omits the section entirely rather than rendering an empty list).
- Used in two places: the channel wire-preview inline editor (`WirePreviewExportNameCell`,
  shown while editing) and the zone/CHIRP override modal (`CommonOverrideSection`, shown below
  the wire-name editor). Both need `build` + `library` — the section is skipped when either is
  unavailable (e.g. before the library slice loads).
- Optional resolution **columns** on the channels/zones wire-preview lists
  (`WirePreviewDataTable`, hideable, off by default) read from the same
  `wirePreviewResolution.ts` helpers but render independently of this component.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WireNameRemediationMarker.md](./WireNameRemediationMarker.md)
- `src/app/lib/wirePreviewResolution.ts`, `src/app/lib/behaviourResolutionLabels.ts`
- `src/core/import-export/channelBehaviourDefaults/resolve.ts`,
  `src/core/import-export/zoneBehaviourDefaults/resolve.ts`
