# Wire preview UI rework (#349) — progress

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349)  
**Branch:** `349/pskil/wire-preview-performance`

## Shipped

| Slice                          | Status  | Notes                                                                         |
| ------------------------------ | ------- | ----------------------------------------------------------------------------- |
| 1 — DataTable + modal shell    | Shipped | `WirePreviewDataTable`, `WirePreviewOverrideModal`, `DataTable.onRowActivate` |
| 2 — Simple entity list + modal | Shipped | `BuildWirePreviewListPage`; TG, contacts, RGL, scan lists                     |
| 3 — Channel list + bulk edit   | Shipped | `/builds/:id/channels/bulk`, expansion modal context                          |
| 4 — Zone list + scan modal     | Shipped | `ZoneScanOverrideSection` in override modal                                   |
| 5 — CHIRP flat memory          | Shipped | `BuildFlatMemoryChannelsPage` list + modal + reorder                          |
| 6 — Anytone airband + cleanup  | Shipped | Embedded list sections; `WirePreviewTable` slimmed for tests                  |
| 7 — Documentation              | Shipped | `wire-preview.md`, sidecars, README status                                    |

## Verify

- [x] `npm run lint && npm run test && npm run build`
- [x] `WirePreviewDataTable` — badges, no inputs, reorder callbacks
- [x] `WirePreviewOverrideModal` — common fields call persist callbacks
- [x] Bulk edit page — apply/revert wire names; unsaved navigation guard
- [x] CHIRP — reorder updates `orderOrSlot`; table sort does not
- [x] DM32 zone modal — scan list export toggle + member inclusion persist
- [x] Trait-gated routes unchanged when traits absent
- [ ] Manual QA on large fixture (operator smoke before merge)
