# Anytone CSV reconciliation — progress

**Tracking:** [codeplug-studio#297](https://github.com/pskillen/codeplug-studio/issues/297)  
**Parent:** [#228](https://github.com/pskillen/codeplug-studio/issues/228) Phase 7 export  
**Branch:** `297/pskil/anytone-dmr-digital-contact-list-audit`  
**Operator reference export:** `C:\Users\pskil\Downloads\D890 codeplug export` (38 CSV + `mm9pdy.LST`; not committed — redact before fixtures)

**Related docs:**

- [csv-reconciliation-gaps.md](csv-reconciliation-gaps.md) — variance findings vs Studio export
- [csv-reconciliation-outstanding.md](csv-reconciliation-outstanding.md) — discovered debt / follow-ups
- Tier-3 enum checklist: [enum-verification.md](../../../reference/anytone/enum-verification.md)
- Proposed follow-up tickets: see **Outstanding** checkboxes and P0/P1 sections below (local draft also at `tmp/anytone-csv-reconciliation-follow-up-tickets.md`, gitignored)

---

## Overall status

**Status:** In progress

---

## Slice 1 — Audit kickoff + documentation

**Status:** Complete

**Delivered**

- Branch `297/pskil/anytone-dmr-digital-contact-list-audit` from `origin/main`
- Full CPS export inventory (38 files) compared against Studio MVP export set (7 DMR + conditional AM/FM)
- [csv-reconciliation-gaps.md](csv-reconciliation-gaps.md) — header/schema and structural gaps
- [enum-verification.md](../../../reference/anytone/enum-verification.md) — enum columns observed in operator export; manual CPS elicitation checklist
- Progress / outstanding pair (this file + sibling)
- Follow-up ticket proposals in `tmp/`

**Verify**

- Re-read gaps doc against `D890 codeplug export` when operator adds more CPS rows (private contacts, scan lists, NXDN bodies)

---

## Slice 2 — `DMRDigitalContactList.CSV` wire fix

**Status:** Complete (pending commit)

**Delivered**

- `DIGITAL_CONTACT_COL` / headers aligned to 10-column CPS schema
- `serialiseDigitalContactsCsv()` maps `digitalId`, wire name, export defaults
- Directional test in `serialise.test.ts`; `detectKind` test in `columns.test.ts`
- Tier-3 [talk-groups.md](../../../reference/anytone/talk-groups.md) export-default table

---

## Slice 3 — CPS fixture rows (private contact + scan lists)

**Status:** Complete

**Delivered**

- Redacted `DMRDigitalContactList.CSV` body row in `test-data/anytone/at-d890uv/`
- Two-row `ScanList.CSV` fixture documenting `Revert Channel` variants
- Tier-3 updates: [talk-groups.md](../../../reference/anytone/talk-groups.md), [scan-lists.md](../../../reference/anytone/scan-lists.md), [enum-verification.md](../../../reference/anytone/enum-verification.md)

---

## Slice 4 — `AMZone.CSV` wire schema ([#316](https://github.com/pskillen/codeplug-studio/issues/316))

**Status:** Complete (docs / fixture; serialiser outstanding on #316)

**Delivered**

- Populated `AMZone.CSV` reverse-engineered from operator `D890 codeplug export` (2 body rows)
- Confirmed 5-column schema including `No.`; distinct from `DMRZone.CSV`
- Documented `AMAir.CSV` NUL-in-Name quirk as CPS corruption (do not model)
- Redacted fixture `test-data/anytone/at-d890uv/AMZone.CSV` + tier-3 [am-air.md](../../../reference/anytone/am-air.md)

**Verify**

- Re-read [am-air.md](../../../reference/anytone/am-air.md) against fixture headers before implementing `serialiseAmZonesCsv`

---

## Slice 5 — `AMZone.CSV` export partition ([#316](https://github.com/pskillen/codeplug-studio/issues/316))

**Status:** Complete

**Delivered**

- `partitionAnytoneZones` + `serialiseAmZonesCsv` — airband members in `AMZone.CSV` only; filtered from `DMRZone.CSV`
- Conditional export file list + `.LST` index 30; Export UI individual download + preview
- Anytone **Airband** build wire-preview route (`/builds/:id/airband`); airband filtered off Channels/Zones
- Directional tests in `amZoneExport.test.ts`; preview filter tests in `previewWireRows.test.ts`

---

## Next

1. ~~Manual CPS enum elicitation — [#307](https://github.com/pskillen/codeplug-studio/issues/307)~~ → absorbed by [#357](https://github.com/pskillen/codeplug-studio/issues/357) (docs + tickets; code deferred to child issues under [#228](https://github.com/pskillen/codeplug-studio/issues/228))

---

## Slice 6 — Wire gap analysis docs ([#357](https://github.com/pskillen/codeplug-studio/issues/357))

**Status:** Complete (docs + tickets phase)

**Branch:** `357/pskil/wire-gap-docs-tickets`

**Delivered**

- Tier-3 updates: [enum-verification.md](../../../reference/anytone/enum-verification.md), [channels.md](../../../reference/anytone/channels.md), [scan-lists.md](../../../reference/anytone/scan-lists.md), contacts/zones/banks, [at-d890uv.md](../../../reference/anytone/radios/at-d890uv.md)
- VFO emit requirement closed as non-issue; power / scan / Busy Lock semantics documented
- Feature hubs + gaps/outstanding synced; child tickets/epics filed under #228 / #147 / #1 / #247

**Verify**

- Re-read enum-verification against CPS when implementing Mid/Turbo power or ScanList defaults