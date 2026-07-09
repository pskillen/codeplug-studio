# Anytone CSV reconciliation — outstanding

Items **skipped**, **incomplete**, or **discovered during** [#297](https://github.com/pskillen/codeplug-studio/issues/297) — not the full export epic backlog.

**Tracking:** [#297](https://github.com/pskillen/codeplug-studio/issues/297) · **Gaps:** [csv-reconciliation-gaps.md](csv-reconciliation-gaps.md)

---

## Wire schema / serialiser

- [x] **`DMRDigitalContactList.CSV`** — 10-column schema + serialiser ([#297](https://github.com/pskillen/codeplug-studio/issues/297) slice 2)
- [ ] **`Channel.CSV` VFO rows** — CPS includes slots `4001` / `4002`; Studio `serialiseChannelsCsv()` does not append them (see gaps doc P0)
- [ ] **`DMR MODE` column** — Studio always exports `0`; operator comment suggests split-frequency → repeater / simplex → DMO — **contradicts** rich export sample (most repeaters still `0`). Needs CPS enum elicitation ([#297](https://github.com/pskillen/codeplug-studio/issues/297) comment)
- [ ] **AM air zone partition** — `AMZone.CSV` + separate zone membership when airband mode active; do not mix airband channels into `DMRZone.CSV` ([#297](https://github.com/pskillen/codeplug-studio/issues/297) comment)

## Enum / value coverage

- [ ] **Private contact `Call Type` / `Call Alert`** — no body rows in operator export; elicit in CPS ([enum-verification.md](../../../reference/anytone/enum-verification.md))
- [ ] **`ScanList.CSV` timing enums** — header-only in rich export; Studio hard-codes fixture defaults (`Scan Mode` = `Off`, `Revert Channel` = `Selected + TalkBack`, …)
- [ ] **`Transmit Power` = `Turbo`** — observed in rich export; confirm power ladder mapping in `profiles.ts`
- [ ] **`OptionalSetting.CSV`** — 199 columns, single row; radio-specific settings candidate for build-scoped model ([#297](https://github.com/pskillen/codeplug-studio/issues/297) comment)

## Channel export behaviour (from #297 comments)

- [ ] **TX contact from RGL** — export channel TX contact from receive group list member, not always Local 9
- [ ] **Send Talker Alias DMR/NX** — per-channel flag; enum values mostly `0` in sample
- [ ] **APRS RX** — separate APRS ticket; wire columns documented during reconciliation pass

## Fixtures / samples

- [ ] **Rich comparison bundle** — commit redacted subset of `D890 codeplug export` once private-contact body row exists (do not commit raw Downloads path)
- [ ] **`ScanList.CSV` body row** — operator export has 0 scan lists despite scan-capable channels; populate in CPS for enum + golden coverage

## Resolved elsewhere

- [x] Cross-file wire name FK drift — [#292](https://github.com/pskillen/codeplug-studio/issues/292)
- [x] CRLF line endings — [#291](https://github.com/pskillen/codeplug-studio/issues/291) / [#296](https://github.com/pskillen/codeplug-studio/pull/296)
- [x] CPS `.LST` manifest on ZIP export — [#289](https://github.com/pskillen/codeplug-studio/issues/289)
