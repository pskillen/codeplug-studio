# CHIRP CSV — progress

**Tracking:** [#38](https://github.com/pskillen/codeplug-studio/issues/38) · branch `38/pskil/chirp-csv-export`

## Shipped / in flight

| Slice | Status | Notes |
| --- | --- | --- |
| Feature hub + progress docs | In progress | `docs/features/import-export/chirp/` |
| Tier-3 profile id alignment | In progress | `chirp-uv5r`, `chirp-rt95`, `chirp-uv21` |
| Profiles + columns + fixtures | Pending | `formats/chirp/` |
| Flat memory assemble | Pending | `flatMemoryLayout.ts`, `assemble.ts` |
| Export adapter | Pending | `serialise.ts`, `channelWire.ts` |
| Memories UI + wire preview | Pending | `BuildMemoriesPage` |
| Export panel + single-file path | Pending | `exportBuildSingleFile` |
| Golden export tests | Pending | Three profile fixtures |
| Epic closeout docs | Pending | Hub status → shipped |

## Verify

- `npm run test` — CHIRP adapter + serialise tests
- Manual: CHIRP build → Memories reorder → Export CSV
