# CPS wire verify — progress

**Tracking:** [codeplug-studio#480](https://github.com/pskillen/codeplug-studio/issues/480) · [PR #483](https://github.com/pskillen/codeplug-studio/pull/483)
**Branch:** `480/patricks/cps-wire-verify`

---

## Overall status

**Status:** Complete (pending merge)
**Branch:** `480/patricks/cps-wire-verify`

---

## Anytone AT-D890UV (v1)

**Status:** Complete (pending merge)
**PR:** [#483](https://github.com/pskillen/codeplug-studio/pull/483)

**Delivered**

- `cps-verify/` scaffold, CLI, Vitest, Dorny CI
- Anytone structural rules + fixtures under profile path `fixtures/anytone/anytone-at-d890uv/`
- CLI `--format` / `--profile`

**Verify**

- `npm run test:cps-verify`
- `npm run verify:codeplug -- --format anytone cps-verify/fixtures/anytone/anytone-at-d890uv/good`

---

## Profile-scoped layout + sync contract

**Status:** Complete

**Delivered**

- Fixture paths `fixtures/<formatId>/<profileId>/…`
- `--profile` CLI option with format defaults
- Docs↔suite sync contract in [wire-verification.md](wire-verification.md)

---

## DM32 / OpenGD77-1701 / CHIRP-uv5r

**Status:** Complete (pending merge)

**Delivered**

- Tier-3 Wire verification sections + plugins + fixtures + Vitest for:
  - `dm32` / `dm32-baofeng-dm32uv` (CRLF)
  - `opengd77` / `opengd77-1701` (LF, synthesized good bundle)
  - `chirp` / `chirp-uv5r` (LF; good sample truncated names from CHIRP golden to Studio `nameLimit`)

**Verify**

- `npm run test:cps-verify`
- `npm run verify:codeplug -- --format dm32 cps-verify/fixtures/dm32/dm32-baofeng-dm32uv/good`
- `npm run verify:codeplug -- --format opengd77 cps-verify/fixtures/opengd77/opengd77-1701/good`
- `npm run verify:codeplug -- --format chirp cps-verify/fixtures/chirp/chirp-uv5r/good`
