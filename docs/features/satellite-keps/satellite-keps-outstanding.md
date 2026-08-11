# Satellite keps — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [codeplug-studio#848](https://github.com/pskillen/codeplug-studio/issues/848)

---

## Deferred by plan (tracked under existing tickets, not re-listed here as debt)

Radio write (#854, #855–#859) is intentionally out of scope for this plan — tracked directly on those tickets, not duplicated here.

---

## Discovered during execution

- **IndexedDB rows aren't re-normalized on schema migrations, only import/export rows are — check for this on every future `Satellite`/library schema bump.** The epic-#1037 multi-transmitter migration (native-yaml `validate.ts`) only ran at the file import/export boundary; a satellite already persisted to a browser's IndexedDB before the schema-26 bump kept its legacy scalar shape and crashed on read (`transmitters: undefined`). Fixed in [PR #1055](https://github.com/pskillen/codeplug-studio/pull/1055) by adding a `readSatelliteRow` normalizer (mirroring the existing `readChannelRow`/`readRadioBuildRow` pattern) — but this class of bug is easy to reintroduce on the _next_ schema bump if the "migrate on read from IndexedDB, not just on file import" step is skipped again. Worth a note in whatever schema-migration checklist/skill this repo uses, if one gets written.
- **`SatelliteTransmitter` has no radio-write-selection field.** `tmp/features/satellite/d890-keps-upload/plan.md` (Part B, Anytone D890 write) anticipated adding `includeInWrite: boolean` as part of the multi-transmitter model work; the 8 PRs that actually shipped epic #1037 didn't include it (they were executed directly against `tmp/features/satellite/spacecraft-multi-transciever/`'s own plan series, which predates and doesn't know about the D890-write plan's deviation). Not a bug — just a gap Part B needs to close itself before any write packer can filter by selection. See `tmp/features/satellite/d890-keps-upload/multi-radio-handover.md`.
