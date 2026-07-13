# Wire preview UI rework (#349) — progress

**Tracking:** [#349](https://github.com/pskillen/codeplug-studio/issues/349)  
**Branch:** `349/pskil/wire-preview-performance`

## Shipped

| Slice | Status | Notes |
| --- | --- | --- |
| 1 — DataTable + modal shell | Shipped | `WirePreviewDataTable`, `WirePreviewOverrideModal`, `DataTable.onRowActivate` |
| 2 — Simple entity list + modal | Shipped | `BuildWirePreviewListPage`; TG, contacts, RGL, scan lists |
| 3 — Channel list + bulk edit | Shipped | `/builds/:id/channels/bulk`, expansion modal context |
| 4 — Zone list + scan modal | Shipped | `ZoneScanOverrideSection` in override modal |
| 5 — CHIRP flat memory | In progress | |

## Verify

- [ ] `npm run lint && npm run test && npm run build`
