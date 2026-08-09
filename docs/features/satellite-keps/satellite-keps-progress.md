# Satellite keps — progress

**Tracking:** [codeplug-studio#848](https://github.com/pskillen/codeplug-studio/issues/848)
**Plan:** `/Users/patricks/.claude/plans/epic-satellite-keps-support-atomic-charm.md`
**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Overall status

**Status:** In progress

**Branch:** `848/pskillen/satellite-keps-and-tracking-mvp`

---

## Slice 1: Core TLE parser + orbital model (#850)

**Status:** Complete (pending merge)

**Delivered**

- `src/core/models/satellite.ts` — vendor-neutral `Satellite` model; raw `tleLine1`/`tleLine2` are the persisted source of truth, decoded fields are display-only.
- `src/core/domain/tle/{parseTle,tleTypes}.ts` — fixed-column TLE parsing, modulo-10 checksum validation, collect-and-continue on malformed groups.
- `src/core/domain/tle/parseTle.test.ts` + `__fixtures__/{valid,invalid}.tle` — happy path + bad-checksum/truncated-line coverage.

**Verify**

- `npx vitest run src/core/domain/tle/` — 7/7 passing.
- No React/DOM import in the module (layer boundary respected).

---

## Slice 2: CelesTrak/AMSAT fetch proxy + client (#851)

**Status:** Not started

---

## Slice 3: Per-project persistence + schema bump (#852)

**Status:** Not started

---

## Slice 4: Satellite Keps library list UI (#853)

**Status:** Not started

---

## Next

- Start Slice 1 (core TLE parser + orbital model).
