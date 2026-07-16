# Anytone CPS CSV — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not scheduled export-adapter phases.

**Tracking:** [#228](https://github.com/pskillen/codeplug-studio/issues/228) · [#229](https://github.com/pskillen/codeplug-studio/issues/229) (import)

---

## Shipped in Phase 7 export ([#228](https://github.com/pskillen/codeplug-studio/issues/228))

- [x] **DMR MVP export** — core DMR CSV bundle + ZIP ([#233](https://github.com/pskillen/codeplug-studio/issues/233))
- [x] **Dedicated scan lists** — library `ScanList` entity + `Channel.scanListId` ([#257](https://github.com/pskillen/codeplug-studio/issues/257), [#234](https://github.com/pskillen/codeplug-studio/issues/234))
- [x] **Export scan UI** — hide DM32-style default scan inclusion on dedicated-scan builds ([#258](https://github.com/pskillen/codeplug-studio/issues/258))
- [x] **Directional export goldens** — `exportGolden.test.ts` ([#236](https://github.com/pskillen/codeplug-studio/issues/236))

---

## Build model notes (post-#243)

- **`orderOrSlot` on `BuildEntityOverride`** — shipped for CHIRP flat memory ([#243](https://github.com/pskillen/codeplug-studio/pull/243)). Anytone `Channel.CSV` / `AMAir.CSV` / `FM.CSV` `No.` columns are the likely export target for the same field (including fixed VFO slot numbers). Confirm per-bank behaviour in [#232](https://github.com/pskillen/codeplug-studio/issues/232) / [#233](https://github.com/pskillen/codeplug-studio/issues/233).

## Model gaps (discovered during wire spike)

- [x] **APRS export** — `APRS.CSV` + channel APRS columns shipped ([#251](https://github.com/pskillen/codeplug-studio/issues/251)). Tier-1: [aprs/](../aprs/README.md).
- [x] **APRS slots on analog channels** — `channelN` resolves across `Channel.CSV` / `AMAir.CSV` / `FM.CSV` ([#359](https://github.com/pskillen/codeplug-studio/issues/359)).
- [ ] **NXDN multi-protocol build** — parallel NX* file set mirrors DMR; may need build trait or export partition beyond DMR-only zone grouping. Wire documented; adapter deferred post-DMR MVP ([#233](https://github.com/pskillen/codeplug-studio/issues/233)).
- [x] **AM air + broadcast FM export projection** — `AMAir.CSV` / `FM.CSV` partition ([#267](https://github.com/pskillen/codeplug-studio/issues/267), [#268](https://github.com/pskillen/codeplug-studio/issues/268))
- [x] **Cross-file wire name shortening** — shared export wire context; preview alignment ([#292](https://github.com/pskillen/codeplug-studio/issues/292))

---

## Sample export quirks

- `DMRDigitalContactList.CSV` — one private-contact row in committed fixture (redacted from operator re-export, July 2026).
- `ScanList.CSV` — two rows in fixture; operator sample uses `Dwell Time[s]` = `3.1` vs Studio export `1.0`.
- NX contact / talk group / RGL files — header only in operator fixture source; wire docs derived from headers + `Channel.CSV` NXDN tail columns.
- `AMZone.CSV` — two redacted body rows in fixture; export partition shipped ([#316](https://github.com/pskillen/codeplug-studio/issues/316)).

---

## Wave 3 — m×n expansion + scratch ([#305](https://github.com/pskillen/codeplug-studio/issues/305), [#325](https://github.com/pskillen/codeplug-studio/issues/325))

- [x] **m×n channel expansion** — optional export-time fan-out ([#305](https://github.com/pskillen/codeplug-studio/issues/305))
- [x] **Scratch channels** — per-repeater companion when expansion on ([#325](https://github.com/pskillen/codeplug-studio/issues/325))
- [x] **Operator docs** — [export-projections.md](anytone/export-projections.md)

---

## Wire gap analysis ([#357](https://github.com/pskillen/codeplug-studio/issues/357))

Docs + tickets phase shipped (adapter code deferred to child issues):

- [x] Tier-3 enum checklist + entity wire docs updated from CPS elicitation
- [x] VFO rows — Studio need not emit (CPS adds on import); supersedes intent of [#375](https://github.com/pskillen/codeplug-studio/issues/375)
- [x] [#391](https://github.com/pskillen/codeplug-studio/issues/391) — power ladder Mid + Turbo
- [x] [#392](https://github.com/pskillen/codeplug-studio/issues/392) — Call Confirmation / SMS Confirmation defaults On
- [ ] [#393](https://github.com/pskillen/codeplug-studio/issues/393) — ScanList timing defaults + Scan Mode readiness
- [x] [#394](https://github.com/pskillen/codeplug-studio/issues/394) — Squelch Mode from RX tone
- [ ] [#395](https://github.com/pskillen/codeplug-studio/issues/395) — Slot Suit export
- [ ] [#396](https://github.com/pskillen/codeplug-studio/issues/396) — Busy Lock/TX Permit mode-aware export
- [ ] [#388](https://github.com/pskillen/codeplug-studio/issues/388) — Epic: library defaults / override cascade (under [#147](https://github.com/pskillen/codeplug-studio/issues/147))
- [ ] [#397](https://github.com/pskillen/codeplug-studio/issues/397) — operator radio ID list
- [ ] [#398](https://github.com/pskillen/codeplug-studio/issues/398) — Send Talker Alias tri-state
- [ ] [#399](https://github.com/pskillen/codeplug-studio/issues/399) — analog compander flag (under [#179](https://github.com/pskillen/codeplug-studio/issues/179))
- [ ] [#389](https://github.com/pskillen/codeplug-studio/issues/389) — Epic: analog FM ident tones (under [#1](https://github.com/pskillen/codeplug-studio/issues/1))
- [ ] [#390](https://github.com/pskillen/codeplug-studio/issues/390) — Epic: DMR roaming (under [#1](https://github.com/pskillen/codeplug-studio/issues/1))
- [ ] [#400](https://github.com/pskillen/codeplug-studio/issues/400) — NXDN wire elicitation (under [#247](https://github.com/pskillen/codeplug-studio/issues/247))

---

## Epic deferrals

- [ ] Anytone **import** — epic [#229](https://github.com/pskillen/codeplug-studio/issues/229) (Phase 7b)
- [ ] Sibling variants (AT-D878UV, AT-D578UV, …)
- [ ] Encryption, hotkeys, `OptionalSetting.CSV` — skip (not a full CPS)
- [ ] DMR roaming / GPS roaming files — [#390](https://github.com/pskillen/codeplug-studio/issues/390)
- [ ] Analog FM ident tones (DTMF / 2Tone / 5Tone) — [#389](https://github.com/pskillen/codeplug-studio/issues/389)

---

## Redaction rules (fixtures)

Operator export redacted before commit:

| Source pattern              | Fixture replacement        |
| --------------------------- | -------------------------- |
| Calls signs / operator IDs  | `TEST01`, `1234567`        |
| Personal channel/zone names | `Channel 1`, `Zone A`, …   |
| APRS callsigns / digi text  | Synthetic / empty          |
| Real repeater / station IDs | Public or synthetic TG IDs |

Do not commit raw Downloads folder or `sample-exports/` personal data.
