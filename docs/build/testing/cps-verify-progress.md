# CPS wire verify — progress

**Tracking:** [codeplug-studio#480](https://github.com/pskillen/codeplug-studio/issues/480) · [PR #483](https://github.com/pskillen/codeplug-studio/pull/483)
**Branch:** `480/patricks/cps-wire-verify`

---

## Overall status

**Status:** In progress

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

## Profile-scoped layout

**Status:** In progress

**Delivered**

- Fixture paths `fixtures/<formatId>/<profileId>/…`
- `--profile` CLI option with format defaults

---

## Next

- Docs↔suite sync contract
- DM32 / OpenGD77-1701 / CHIRP-uv5r plugins
