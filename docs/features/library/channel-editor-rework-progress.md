# Channel editor rework — progress

**Tracking:** [codeplug-studio#1265](https://github.com/pskillen/codeplug-studio/issues/1265) — parent epic [#498](https://github.com/pskillen/codeplug-studio/issues/498)
**Branch:** `1265/pskillen/channel-editor-rework`
**Plan:** `tmp/features/channel-editor-rework/plan.md` (gitignored scratch — this file is the durable record)

## Shipped slices

| #   | Slice                                 | Commit     | Notes                                                                                                                                                       |
| --- | ------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fix false-dirty on new-entity editors | `491898c9` | `base` snapshot moved into `useState(() => …)` in `ChannelEditor.tsx`                                                                                       |
| 2   | Section ids + sticky jump-nav         | (pending)  | New `channelEditorSections.ts`, `useSectionScrollSpy.ts`; `SectionNav` gains `{id,label}` item form; sticky horizontal strip wired into `ChannelEditor.tsx` |

## Next

Continue with slices 3–7 per the plan. Update this table at every commit checkpoint.

## Verify steps

- `/library/channels/new` → Cancel immediately → no "Discard unsaved changes?" prompt.
