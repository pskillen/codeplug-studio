# Baofeng DM32 CSV export — progress

**Epic:** [#37](https://github.com/pskillen/codeplug-studio/issues/37) (Phase 5 — DM32 CSV **export**)  
**Import epic:** [#112](https://github.com/pskillen/codeplug-studio/issues/112) (Phase 5b)  
**Tier-3 wire reference:** [docs/reference/dm32/](../../reference/dm32/README.md)  
**Archive reference:** [codeplug-tool#67](https://github.com/pskillen/codeplug-tool/issues/67)

---

## Overall status

**Status:** In progress — ticket breakdown filed 2026-07-02

| Phase | Issue | Status | Notes |
| --- | --- | --- | --- |
| TG abbrev + multi-TG wire core | [#110](https://github.com/pskillen/codeplug-studio/issues/110) | Complete | Shipped |
| Zone export trait refactor | [#104](https://github.com/pskillen/codeplug-studio/issues/104) | Open | Next executable (parallel with #114) |
| Feature hub README | [#113](https://github.com/pskillen/codeplug-studio/issues/113) | Open | Can fold into #114 PR |
| Profiles + columns + fixtures | [#114](https://github.com/pskillen/codeplug-studio/issues/114) | Open | Blocks export adapter |
| Zone export trait UI | [#121](https://github.com/pskillen/codeplug-studio/issues/121) | Open | After #104 |
| Export adapter | [#115](https://github.com/pskillen/codeplug-studio/issues/115) | Open | Wire #110 expansion core |
| Export UI + wire preview fan-out | [#119](https://github.com/pskillen/codeplug-studio/issues/119) | Open | `showMultiTalkGroupOptions` |
| Directional export tests | [#122](https://github.com/pskillen/codeplug-studio/issues/122) | Open | After #115 |
| Export epic closeout docs | [#123](https://github.com/pskillen/codeplug-studio/issues/123) | Open | After export ship |

**Import (Phase 5b — [#112](https://github.com/pskillen/codeplug-studio/issues/112)):** [#124](https://github.com/pskillen/codeplug-studio/issues/124)–[#128](https://github.com/pskillen/codeplug-studio/issues/128) — deferred until export foundation (#114) lands.

**Prerequisite (shipped):** OpenGD77 wire preview + name shortening — [opengd77-progress.md](opengd77-progress.md) ([#87](https://github.com/pskillen/codeplug-studio/issues/87)–[#90](https://github.com/pskillen/codeplug-studio/issues/90)).

---

## Slice — Talk group abbreviation ([#110](https://github.com/pskillen/codeplug-studio/issues/110))

**Status:** Complete

**Delivered**

- Progress tracking kickoff — this file + [dm32-outstanding.md](dm32-outstanding.md)
- Core — `multiTalkGroupWireName.ts`, `multiTalkGroup.ts`, `entityRefExport.ts`, `talkGroupWireNamePreview.ts`; `CpsExportOptions` multi-TG fields; unit tests (incl. m×n)
- Library CRUD — `TalkGroupEditor` with abbreviation + `TalkGroupWireNameExamples`; list Abbrev column; native YAML round-trip test
- Docs — [library README](../library/README.md), [name-shortening.md](name-shortening.md)

**Not wired yet** (tracked in [#115](https://github.com/pskillen/codeplug-studio/issues/115), [#119](https://github.com/pskillen/codeplug-studio/issues/119))

- `expandMultiTalkGroupMemberWireRows` not called from DM32 serialise or wire preview
- `showMultiTalkGroupOptions` hidden on export panel until DM32 export ships

---

## Recommended execution order

1. [#104](https://github.com/pskillen/codeplug-studio/issues/104) ∥ [#114](https://github.com/pskillen/codeplug-studio/issues/114)
2. [#113](https://github.com/pskillen/codeplug-studio/issues/113) (optional fold into #114)
3. [#121](https://github.com/pskillen/codeplug-studio/issues/121) — after #104
4. [#115](https://github.com/pskillen/codeplug-studio/issues/115) → [#119](https://github.com/pskillen/codeplug-studio/issues/119) → [#122](https://github.com/pskillen/codeplug-studio/issues/122) → [#123](https://github.com/pskillen/codeplug-studio/issues/123)
5. Phase 5b import epic [#112](https://github.com/pskillen/codeplug-studio/issues/112) after #114
