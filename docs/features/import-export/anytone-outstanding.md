# Anytone CPS CSV — outstanding

Active debt under epic [#505](https://github.com/pskillen/codeplug-studio/issues/505) (supersedes M1 [#228](https://github.com/pskillen/codeplug-studio/issues/228) / [#229](https://github.com/pskillen/codeplug-studio/issues/229)).

Variance history: [csv-reconciliation-gaps.md](anytone/csv-reconciliation-gaps.md) · thin follow-ups: [csv-reconciliation-outstanding.md](anytone/csv-reconciliation-outstanding.md)

---

## Open (issue-tracked)

### Export / wire

- [ ] [#393](https://github.com/pskillen/codeplug-studio/issues/393) — ScanList Scan Mode readiness
- [ ] [#395](https://github.com/pskillen/codeplug-studio/issues/395) — Slot Suit export
- [ ] [#418](https://github.com/pskillen/codeplug-studio/issues/418) — exclude FM broadcast from `DMRZone.CSV`
- [ ] [#484](https://github.com/pskillen/codeplug-studio/issues/484) — omit AM airband from `ScanList.CSV`
- [ ] [#400](https://github.com/pskillen/codeplug-studio/issues/400) — NXDN wire elicitation (under [#247](https://github.com/pskillen/codeplug-studio/issues/247))
- [ ] NXDN multi-protocol build / export — after [#400](https://github.com/pskillen/codeplug-studio/issues/400); see [#233](https://github.com/pskillen/codeplug-studio/issues/233) notes
- [ ] [#531](https://github.com/pskillen/codeplug-studio/issues/531) — remaining CSV elicitation (Digital Duplex, TX-from-RGL)

### Import

- [ ] [#238](https://github.com/pskillen/codeplug-studio/issues/238)–[#242](https://github.com/pskillen/codeplug-studio/issues/242) — import parse / adapter / UI / tests / docs

### Cross-cutting (not Anytone-only)

- [ ] [#388](https://github.com/pskillen/codeplug-studio/issues/388) — library defaults / override cascade ([#147](https://github.com/pskillen/codeplug-studio/issues/147))
- [ ] [#397](https://github.com/pskillen/codeplug-studio/issues/397) — operator radio ID list
- [ ] [#399](https://github.com/pskillen/codeplug-studio/issues/399) — analog compander ([#498](https://github.com/pskillen/codeplug-studio/issues/498))
- [ ] [#389](https://github.com/pskillen/codeplug-studio/issues/389) — analog FM ident tones ([#497](https://github.com/pskillen/codeplug-studio/issues/497))
- [ ] [#390](https://github.com/pskillen/codeplug-studio/issues/390) — DMR roaming ([#497](https://github.com/pskillen/codeplug-studio/issues/497))

## Explicit skips / hub notes

- Encryption, hotkeys, `OptionalSetting.CSV` — not a full CPS; skip
- Sibling radio variants (AT-D878UV, …) — schedule under [#505](https://github.com/pskillen/codeplug-studio/issues/505) when needed

## Shipped highlights

- [x] DMR MVP export [#233](https://github.com/pskillen/codeplug-studio/issues/233) · scan lists [#257](https://github.com/pskillen/codeplug-studio/issues/257) · APRS [#251](https://github.com/pskillen/codeplug-studio/issues/251)
- [x] m×n + scratch [#305](https://github.com/pskillen/codeplug-studio/issues/305) / [#325](https://github.com/pskillen/codeplug-studio/issues/325)
- [x] [#398](https://github.com/pskillen/codeplug-studio/issues/398) — Send Talker Alias (cascade; export default may still be `0`)
- [x] [#402](https://github.com/pskillen/codeplug-studio/issues/402) — code ↔ wire docs mop-up
