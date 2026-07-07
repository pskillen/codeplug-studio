# Scan inclusion — progress

**Tracking:** [#203](https://github.com/pskillen/codeplug-studio/issues/203)  
**Branch:** `203/pskil/tri-state-scan-inclusion`

## Status

Complete — pending PR.

## Shipped

- `Channel.scanInclusion` tri-state (`default` / `skip` / `alwaysScan`); schema v8; legacy `scanSkip` migration
- `FormatBuild.exportSettings` + adapter `defaultExportSettings`; `mergeExportOptions`
- OpenGD77 / DM32 export mappers use shared resolver
- CHIRP wire helpers (adapter still `planned`)
- Export settings moved from global `localStorage` to build row (one-time migration on export panel)
- `ScanInclusionSegment` on channel editor; `DefaultScanInclusionSegment` on build export panel
- Docs: [scan-inclusion.md](../../reference/scan-inclusion.md), tier-1/3 updates

## Next

- Open PR; push to `dev` for remote review
