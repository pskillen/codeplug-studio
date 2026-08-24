# Channel editor rework — outstanding

**Tracking:** [codeplug-studio#1265](https://github.com/pskillen/codeplug-studio/issues/1265)

Debt discovered during execution — not a duplicate of the plan's slice list.

- **Same false-dirty `base` pattern in seven sibling entity editors** (`AnalogContactEditor.tsx`, `AprsConfigurationEditor.tsx`, `DigitalContactEditor.tsx`, `RxGroupListEditor.tsx`, `ScanListEditor.tsx`, `TalkGroupEditor.tsx`, `ZoneEditor.tsx`). Slice 1 of this ticket fixes only `ChannelEditor.tsx`. Fixing the other seven is out of scope for #1265 — needs its own ticket.
