# Channel editor rework — progress

**Tracking:** [codeplug-studio#1265](https://github.com/pskillen/codeplug-studio/issues/1265) — parent epic [#498](https://github.com/pskillen/codeplug-studio/issues/498)
**Branch:** `1265/pskillen/channel-editor-rework`
**Plan:** `tmp/features/channel-editor-rework/plan.md` (gitignored scratch — this file is the durable record)

## Shipped slices

| #   | Slice                                 | Commit     | Notes                                                                                                                                                                                                                                         |
| --- | ------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fix false-dirty on new-entity editors | `491898c9` | `base` snapshot moved into `useState(() => …)` in `ChannelEditor.tsx`                                                                                                                                                                         |
| 2   | Section ids + sticky jump-nav         | `193aca55` | New `channelEditorSections.ts`, `useSectionScrollSpy.ts`; `SectionNav` gains `{id,label}` item form; sticky horizontal strip wired into `ChannelEditor.tsx`                                                                                   |
| 3   | Identity scoped to minimum; RF rename | (pending)  | Identity now callsign + verify actions + name + read-only RX/TX/band summary (jump-links to RF) + mode chips; new "Names and notes" panel (abbreviation, comment, wire-name preview), `collapsible` on mobile; "Frequency" panel renamed "RF" |

## Next

Continue with slices 4–7 per the plan. Update this table at every commit checkpoint.

## Verify steps

- `/library/channels/new` → Cancel immediately → no "Discard unsaved changes?" prompt.
- Jump-nav scrolls to and highlights Identity / Names and notes / RF / Mode settings / Location / (Zones) / Scanning / APRS.
- Identity's RX/TX/band summary line jump-links to RF.
