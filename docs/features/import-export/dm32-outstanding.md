# Baofeng DM32 CSV export — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [#37](https://github.com/pskillen/codeplug-studio/issues/37) · [#112](https://github.com/pskillen/codeplug-studio/issues/112) (import)

---

## Epic deferrals (post-export closeout)

- [ ] DM32 **import** — epic [#112](https://github.com/pskillen/codeplug-studio/issues/112) (Phase 5b)
- [ ] Manual `ScanList` entity CRUD and scan import round-trip
- [ ] `DMR-ID.csv` export — accepted lossy gap (profile default label only)
- [ ] Full v1.60 fixture row compare — awaits import adapter; header parity + minimal golden bundle shipped in [#122](https://github.com/pskillen/codeplug-studio/issues/122)

---

## Fixed

- [x] **CRLF export line endings** — [#314](https://github.com/pskillen/codeplug-studio/issues/314); Studio DM32 CSV export matches official CPS (Windows CRLF)
- [x] **Per-repeater scratch channel export** — [#140](https://github.com/pskillen/codeplug-studio/issues/140); build `exportScratchChannels` (zone layout flag deprecated)

---

## Discovered during execution

- **Empty `Scan.csv` in ZIP** — export always serialises header row; ZIP includes `Scan.csv` even when no zone scan lists emit (omit-from-ZIP polish optional).
- **Unlinked contacts** — `Contacts.csv` / `DTMFContacts.csv` only include library entities referenced by channels (or forced via build `contactOverrides`).

---

## Manual verify (export epic)

- [ ] DM32 build → Export panel shows zone-derived scan toggle (multi-TG abbrev unified under **Use abbreviations from library**)
- [ ] Wire preview channels page shows RX-list fan-out rows with **displayDetails** (channel + talk group)
- [ ] Wire preview **Hide items not to be included in export** reveals/hides orphans per export inclusion flags
- [ ] Build zones page: per-zone export flags + per-member scan inclusion (DM32 only)
- [ ] Download ZIP: six core CSVs + `Scan.csv` when zone scan enabled; `Scan List` FKs wired
- [ ] Master scan toggle off → no scan lists despite zone flags
- [ ] OpenGD77 export regression unchanged
- [ ] Multi-TG `suffix_tg_number` wire names omit timeslot (ID only)
