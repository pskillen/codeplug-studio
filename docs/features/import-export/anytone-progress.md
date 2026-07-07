# Anytone CPS CSV — progress

**Epic:** [#228](https://github.com/pskillen/codeplug-studio/issues/228) (Phase 7 — Anytone CPS **export**)  
**Import epic:** [#229](https://github.com/pskillen/codeplug-studio/issues/229) (Phase 7b)  
**Hub:** [anytone/README.md](anytone/README.md)  
**Tier-3 wire reference:** [docs/reference/anytone/](../../reference/anytone/README.md)

---

## Overall status

**Status:** Export implementation in progress — branch `228/pskil/anytone-cps-export`  
**Branch:** `228/pskil/anytone-cps-export`

| Phase                       | Issue                                                          | Status   | Notes                                |
| --------------------------- | -------------------------------------------------------------- | -------- | ------------------------------------ |
| Wire spike + fixtures       | [#230](https://github.com/pskillen/codeplug-studio/issues/230) | Complete | DMR + extended wire docs + test-data |
| Feature hub README          | [#231](https://github.com/pskillen/codeplug-studio/issues/231) | Complete | Tier-1 hub + index rows              |
| Profile, columns, registry  | [#232](https://github.com/pskillen/codeplug-studio/issues/232) | Complete | Scaffold on export branch            |
| Export adapter              | [#233](https://github.com/pskillen/codeplug-studio/issues/233) | Complete | DMR MVP serialisers + ZIP            |
| Build editor + wire preview | [#234](https://github.com/pskillen/codeplug-studio/issues/234) | Complete | Scan lists route + channel assignment |
| Format catalog CPS export   | [#235](https://github.com/pskillen/codeplug-studio/issues/235) | Complete | Catalog `exportStatus: shipped`            |
| Directional export tests    | [#236](https://github.com/pskillen/codeplug-studio/issues/236) | Complete | `exportGolden.test.ts`               |
| Export epic reconciliation  | [#237](https://github.com/pskillen/codeplug-studio/issues/237) | Pending  |                                      |

---

## Wave 0 — wire spike + hub

**Status:** Complete

| Slice                    | Status   | Notes                                               |
| ------------------------ | -------- | --------------------------------------------------- |
| Progress pair kickoff    | Complete | `anytone-progress.md`, `anytone-outstanding.md`     |
| DMR core wire + fixtures | Complete | `test-data/anytone/at-d890uv/`, DMR tier-3 docs     |
| Extended feature wire    | Complete | AMAir, FM, APRS, NXDN tier-3 + fixtures             |
| Feature hub + index      | Complete | `anytone/README.md`, features + import-export index |

**Deliverables:**

- Tier-3: `docs/reference/anytone/` (DMR core + am-air, fm-broadcast, aprs, nxdn)
- Fixtures: `test-data/anytone/at-d890uv/` (redacted)
- Tier-1: `docs/features/import-export/anytone/README.md`

**Next:** [#232](https://github.com/pskillen/codeplug-studio/issues/232) — profile, columns scaffold, registry.
