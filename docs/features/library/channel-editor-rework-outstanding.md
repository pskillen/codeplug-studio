# Channel editor rework — outstanding

**Tracking:** [codeplug-studio#1265](https://github.com/pskillen/codeplug-studio/issues/1265)

Debt discovered during execution — not a duplicate of the plan's slice list. All 7 slices shipped; nothing below blocks the PR.

- **Same false-dirty `base` pattern in seven sibling entity editors** (`AnalogContactEditor.tsx`, `AprsConfigurationEditor.tsx`, `DigitalContactEditor.tsx`, `RxGroupListEditor.tsx`, `ScanListEditor.tsx`, `TalkGroupEditor.tsx`, `ZoneEditor.tsx`). Slice 1 of this ticket fixes only `ChannelEditor.tsx`. Fixing the other seven is out of scope for #1265 — needs its own ticket.
- **Design doc's remaining "still open" questions not settled by this ticket** (Q4 BrandMeister lookup visibility before a DMR profile exists on New channel, Q6 duplicate-callsign warning on New channel) are explicitly deferred per the plan's Out-of-scope section, not fixed here — `findChannelByCallsign` reuse for Q6 would be cheap if a future ticket wants it. Q2 (panel naming), Q9 (`neutralValues` as a prop), and Q10 (`SectionNavItem` shape) were resolved during planning, not left open — see `hl-delivery-plan.md` for the reasoning if revisiting.
