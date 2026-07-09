# Anytone CSV reconciliation — outstanding

Items **skipped**, **incomplete**, or **discovered during** [#297](https://github.com/pskillen/codeplug-studio/issues/297) — not the full export epic backlog.

**Tracking:** [#297](https://github.com/pskillen/codeplug-studio/issues/297) · **Gaps:** [csv-reconciliation-gaps.md](csv-reconciliation-gaps.md)

---

## Wire schema / serialiser

- [x] **`DMRDigitalContactList.CSV`** — 10-column schema + serialiser ([#297](https://github.com/pskillen/codeplug-studio/issues/297) slice 2)
- [ ] **`Channel.CSV` VFO rows** — CPS includes slots `4001` / `4002`; Studio `serialiseChannelsCsv()` does not append them (see gaps doc P0)
- [x] **`DMR MODE` column** — ~~Studio always exports `0`~~ **Shipped** ([#311](https://github.com/pskillen/codeplug-studio/issues/311)) — `ChannelModeProfileDMR.dmrMode` + RX/TX inference
- [x] **Dual-mode `Channel Type`** — **Shipped** ([#303](https://github.com/pskillen/codeplug-studio/issues/303)) — `Channel.primaryMode` → `D-Digital` / `A-Analog` / `D+A TX D` / `A+D TX A`
- [x] **`AMZone.CSV` wire schema** — 5-column body-row sample + redacted fixture ([#316](https://github.com/pskillen/codeplug-studio/issues/316))
- [ ] **AM air zone partition serialiser** — emit `AMZone.CSV`; filter airband members out of `DMRZone.CSV` ([#316](https://github.com/pskillen/codeplug-studio/issues/316))

## Enum / value coverage

- [x] **Private contact `Call Type` / `Call Alert`** — `Private Call` / `None` observed; redacted fixture row committed
- [ ] **Private contact `Call Alert` variants** — only `None` so far; elicit other values in CPS
- [x] **`ScanList.CSV` timing / revert enums (partial)** — `Off`, `Selected`, `Selected + TalkBack`, dwell `3.1` observed
- [ ] **`ScanList.CSV` scan modes** — `Scan Mode` and priority columns still `Off` only in sample
- [ ] **`Transmit Power` = `Turbo`** — observed in rich export; confirm power ladder mapping in `profiles.ts`
- [ ] **`OptionalSetting.CSV`** — 199 columns, single row; radio-specific settings candidate for build-scoped model ([#297](https://github.com/pskillen/codeplug-studio/issues/297) comment)

## Channel export behaviour (from #297 comments)

- [ ] **TX contact from RGL** — export channel TX contact from receive group list member, not always Local 9
- [ ] **Send Talker Alias DMR/NX** — per-channel flag; enum values mostly `0` in sample
- [ ] **APRS RX** — separate APRS ticket; wire columns documented during reconciliation pass

## Fixtures / samples

- [x] **Private contact body row** — redacted in `test-data/anytone/at-d890uv/DMRDigitalContactList.CSV`
- [x] **Scan list body rows** — two rows in `test-data/anytone/at-d890uv/ScanList.CSV` (revert-channel variants)
- [ ] **Rich comparison bundle** — full 100-channel operator export still local only; do not commit raw Downloads

## Resolved elsewhere

- [x] Cross-file wire name FK drift — [#292](https://github.com/pskillen/codeplug-studio/issues/292)
- [x] CRLF line endings — [#291](https://github.com/pskillen/codeplug-studio/issues/291) / [#296](https://github.com/pskillen/codeplug-studio/pull/296)
- [x] CPS `.LST` manifest on ZIP export — [#289](https://github.com/pskillen/codeplug-studio/issues/289)
