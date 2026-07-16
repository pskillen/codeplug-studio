# Anytone CSV reconciliation — outstanding

Items **skipped**, **incomplete**, or **discovered during** [#297](https://github.com/pskillen/codeplug-studio/issues/297) / [#357](https://github.com/pskillen/codeplug-studio/issues/357) — not the full export epic backlog.

**Tracking:** [#357](https://github.com/pskillen/codeplug-studio/issues/357) · **Gaps:** [csv-reconciliation-gaps.md](csv-reconciliation-gaps.md)

---

## Wire schema / serialiser

- [x] **`DMRDigitalContactList.CSV`** — 10-column schema + serialiser ([#297](https://github.com/pskillen/codeplug-studio/issues/297))
- [x] **`Channel.CSV` VFO rows** — ~~emit `4001`/`4002`~~ **Not required** — CPS adds on import ([#357](https://github.com/pskillen/codeplug-studio/issues/357))
- [x] **`DMR MODE` column** — **Shipped** ([#311](https://github.com/pskillen/codeplug-studio/issues/311)); `2`/`3` DCDM documented, unsupported export
- [x] **Dual-mode `Channel Type`** — **Shipped** ([#303](https://github.com/pskillen/codeplug-studio/issues/303))
- [x] **`AMZone.CSV` wire schema** + partition serialiser ([#316](https://github.com/pskillen/codeplug-studio/issues/316))
- [x] **`FMZone.CSV`** — does not exist on D890 ([#357](https://github.com/pskillen/codeplug-studio/issues/357))

## Enum / value coverage

- [x] **Call Alert** — `None` / `Online alert` confirmed; not modelled (export `None`)
- [x] **`ScanList.CSV` Scan Mode / Revert / timing** — documented; Studio timing defaults all `5.0` ([#402](https://github.com/pskillen/codeplug-studio/issues/402)); Scan Mode modelling readiness remains [#393](https://github.com/pskillen/codeplug-studio/issues/393)
- [x] **`Transmit Power` Mid / Turbo** — documented + shipped ([#391](https://github.com/pskillen/codeplug-studio/issues/391))
- [x] **Busy Lock / Slot Suit / DataACK / talker alias / …** — documented in [enum-verification.md](../../../reference/anytone/enum-verification.md); library + export tickets (see anytone-outstanding)
- [ ] **`Digital Duplex`** — not found in CPS UI; leave Needs elicitation
- [x] **`OptionalSetting.CSV`** — skip (not a full Anytone CPS)
- [x] **Code ↔ docs mop-up** — inventory/defaults checklist ([#402](https://github.com/pskillen/codeplug-studio/issues/402)); FM-in-DMRZone filed as [#418](https://github.com/pskillen/codeplug-studio/issues/418)

## Channel export behaviour

- [ ] **TX contact from RGL** — open question (operator unsure); no ticket
- [x] **Send Talker Alias DMR/NX** — confirmed `0`/`1`; default still `0` (prefer `1`) — [#398](https://github.com/pskillen/codeplug-studio/issues/398)
- [x] **APRS RX** — shipped separately ([#251](https://github.com/pskillen/codeplug-studio/issues/251))

## Fixtures / samples

- [x] **Private contact body row** — redacted in `test-data/anytone/at-d890uv/DMRDigitalContactList.CSV`
- [x] **Scan list body rows** — two rows in `test-data/anytone/at-d890uv/ScanList.CSV`
- [ ] **Rich comparison bundle** — full 100-channel operator export still local only; do not commit raw Downloads

## Resolved elsewhere

- [x] Cross-file wire name FK drift — [#292](https://github.com/pskillen/codeplug-studio/issues/292)
- [x] CRLF line endings — [#291](https://github.com/pskillen/codeplug-studio/issues/291) / [#296](https://github.com/pskillen/codeplug-studio/pull/296)
- [x] CPS `.LST` manifest on ZIP export — [#289](https://github.com/pskillen/codeplug-studio/issues/289)
- [x] Wire gap docs merge — [#357](https://github.com/pskillen/codeplug-studio/issues/357)
- [x] Export code ↔ wire docs mop-up — [#402](https://github.com/pskillen/codeplug-studio/issues/402)
