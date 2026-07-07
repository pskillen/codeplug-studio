# CHIRP CSV — progress

**Tracking:** [#38](https://github.com/pskillen/codeplug-studio/issues/38) · branch `38/pskil/chirp-csv-export`

## Shipped

| Slice                           | Status   | Notes                                                           |
| ------------------------------- | -------- | --------------------------------------------------------------- |
| Feature hub + progress docs     | Complete | `docs/features/import-export/chirp/`                            |
| Tier-3 profile id alignment     | Complete | `chirp-uv5r`, `chirp-rt95`, `chirp-uv21`                        |
| Profiles + columns + fixtures   | Complete | `formats/chirp/`                                                |
| Flat memory assemble            | Complete | `flatMemoryLayout.ts`, `assemble.ts`                            |
| Export adapter                  | Complete | `serialise.ts`, `channelWire.ts`, `SingleFileCpsExportAdapter`  |
| Channels UI + wire preview      | Complete | `BuildFlatMemoryChannelsPage` — default-include, scan tri-state |
| Export panel + single-file path | Complete | `exportBuildSingleFile`, `ExportBuildCpsPanel`                  |
| Golden export tests             | Complete | `exportGolden.test.ts` — three profile fixtures                 |
| Epic closeout docs              | Complete | Hub status → export shipped                                     |

## Outstanding

See [chirp-outstanding.md](chirp-outstanding.md) — import (#214), DCS modelling, cross-format smoke.

## Verify

- `npm run test` — `formats/chirp/*`, `ExportBuildCpsPanel.test.tsx`
- Manual: CHIRP build → Memories reorder → Export CSV → load in CHIRP
