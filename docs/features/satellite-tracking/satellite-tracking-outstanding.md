# Satellite tracking — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not the plan's future phases.

**Tracking:** [codeplug-studio#860](https://github.com/pskillen/codeplug-studio/issues/860)

**Status:** Wave 2 post-MVP polish in flight — see [satellite-tracking-progress.md](satellite-tracking-progress.md) § Wave 2.

---

## Discovered during execution

- **Globe satellite count cap (C3):** not implemented in [#1014](https://github.com/pskillen/codeplug-studio/issues/1014) — filter-hide may be sufficient; re-evaluate after Wave 2 ships if enabling large satellite sets without filtering still feels heavy.
- **Globe look-behind trail continuity ([#1060](https://github.com/pskillen/codeplug-studio/issues/1060)):** fixed — whole-path dash ratios were hiding most of the past trail; switched to short repeating dashes, minute-based windows, and fade styling.
