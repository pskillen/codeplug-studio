# Baofeng DM32 CSV export — progress

**Epic:** [#37](https://github.com/pskillen/codeplug-studio/issues/37) (Phase 5 — DM32 CSV **export**; import deferred)  
**Plan:** Talk group abbreviation — [#110](https://github.com/pskillen/codeplug-studio/issues/110)  
**Tier-3 wire reference:** [docs/reference/dm32/](../../reference/dm32/README.md)

---

## Overall status

**Status:** In progress

**Branch:** `110/pskil/talk-group-abbreviation`

| Phase | Status | Notes |
| --- | --- | --- |
| Shared export prep — TG abbrev + multi-TG wire names ([#110](https://github.com/pskillen/codeplug-studio/issues/110)) | In progress | This branch |
| DM32 export adapter | Not started | `src/core/import-export/formats/dm32/` |
| DM32 build UI (zones, scan lists, `showMultiTalkGroupOptions`) | Not started | Trait modules under `src/app/` |
| DM32 import adapter | Deferred | Out of epic #37 export scope |

**Prerequisite:** OpenGD77 wire preview + name shortening — [opengd77-progress.md](opengd77-progress.md) ([#87](https://github.com/pskillen/codeplug-studio/issues/87)–[#90](https://github.com/pskillen/codeplug-studio/issues/90)).

---

## Slice — Talk group abbreviation (#110)

**Status:** In progress  
**Branch:** `110/pskil/talk-group-abbreviation`

**Delivered**

- Progress tracking kickoff — this file + [dm32-outstanding.md](dm32-outstanding.md)
- Slice 1 — `multiTalkGroupWireName.ts`, `multiTalkGroup.ts`, `entityRefExport.ts`; `CpsExportOptions` multi-TG fields; unit tests
- Slice 2 — `TalkGroupEditor` with abbreviation + `TalkGroupWireNameExamples`; list Abbrev column; native YAML round-trip test

**Verify**

- `npm run test -- --run src/core/import-export/channelExpansion/`
- Manual: `/library/talk-groups/new` — set name + abbreviation, save, reload

---

## Next

- Complete #110 core multi-TG wire-name module + library CRUD + docs
