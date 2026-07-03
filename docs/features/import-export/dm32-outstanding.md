# Baofeng DM32 CSV export — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [#37](https://github.com/pskillen/codeplug-studio/issues/37) · [#112](https://github.com/pskillen/codeplug-studio/issues/112) (import)

---

## Epic deferrals (post-export closeout)

- [ ] DM32 **import** — epic [#112](https://github.com/pskillen/codeplug-studio/issues/112) (Phase 5b)
- [ ] Manual `ScanList` entity CRUD and scan import round-trip
- [ ] `DMR-ID.csv` export — accepted lossy gap (profile default label only)
- [ ] `exportScratchChannel` serialisation — UI persists layout flag; wire deferred
- [ ] Full v1.60 fixture row compare — awaits import adapter; header parity + minimal golden bundle shipped in [#122](https://github.com/pskillen/codeplug-studio/issues/122)

---

## Discovered during execution

- **Empty `Scan.csv` in ZIP** — export always serialises header row; ZIP includes `Scan.csv` even when no zone scan lists emit (omit-from-ZIP polish optional).
- **Unlinked contacts** — `Contacts.csv` / `DTMFContacts.csv` only include library entities referenced by channels (or forced via build `contactOverrides`).

---

## Manual verify (export epic)

- [ ] DM32 build → Export panel shows multi-TG options + zone-derived scan toggle
- [ ] Wire preview channels page shows RX-list fan-out rows with expansion notes
- [ ] Build zones page: per-zone export flags + per-member scan inclusion (DM32 only)
- [ ] Download ZIP: six core CSVs + `Scan.csv` when zone scan enabled; `Scan List` FKs wired
- [ ] Master scan toggle off → no scan lists despite zone flags
- [ ] OpenGD77 export regression unchanged
