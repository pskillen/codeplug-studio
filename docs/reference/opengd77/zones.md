# OpenGD77 — Zones.csv

Generic column reference for `Zones.csv`. Member column count is radio-profile-specific — see [radios/baofeng-1701.md](radios/baofeng-1701.md).

**Code:** [`columns.ts`](../../../src/core/import-export/formats/opengd77/columns.ts) (`zoneMemberHeaders`) · [`parse.ts`](../../../src/core/import-export/formats/opengd77/parse.ts) · [`serialise.ts`](../../../src/core/import-export/formats/opengd77/serialise.ts) · [`codeplug.ts`](../../../src/core/services/assemble.ts) (`resolveZoneMembers`)

## Wire pattern

| Pattern | Role |
| --- | --- |
| `Zone Name` | Zone display name; unique within codeplug |
| `Channel1` … `ChannelN` | Member channel names in **scan order** |

OpenGD77 has **no separate scan-list file** — zone membership defines the scan sequence on the radio.

Empty member cells are unused slots. Trailing empty columns may be omitted on export.

## Column reference

| Vendor header | Internal field | Required (import) | Import rule | Export rule | Bidirectional mapping | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Zone Name` | `Zone.name` | **Yes** | Trim; skip row if empty | As stored | String pass-through | |
| `Channel1`…`ChannelN` | `Zone.meta.imported.memberWireNames[]` | No | Collect non-empty cells in column order; any `Channel\d+` header | Pad into `Channel1`…`ChannelN` up to profile cap | Lossless names | Also resolved to `memberChannelIds` at import |

## Import resolution

After parsing, the import adapter resolves `sourceMemberNames` to internal channel ids via case-sensitive name lookup:

1. Build `name → channel.id` map from imported channels (first wins on duplicate names).
2. For each member name in order: resolve to id, or record as **unresolved**.
3. Store both `memberChannelIds` (resolved) and `sourceMemberNames` (original wire names).

`resolveZoneMembers` deduplicates by name and by id while preserving first-seen order.

Unresolved member names are preserved in `sourceMemberNames` for export bidirectional mapping even when `memberChannelIds` is incomplete.

## Export

Serialiser writes `sourceMemberNames` into `Channel1`…`ChannelN` in order. Names beyond the radio profile member cap are truncated at export (today: hard-coded profile cap in code).

## CPS behaviour

- New zones can be added by appending rows — member names must **exactly match** `Channel Name` in `Channels.csv`.
- Renaming a channel requires updating every zone reference across all zone rows.

## Related

- [Channels](channels.md)
- [File format rules](file-format.md)
- [Radio profiles](radios/README.md)
