# Channel editor rework — progress

**Tracking:** [codeplug-studio#1265](https://github.com/pskillen/codeplug-studio/issues/1265) — parent epic [#498](https://github.com/pskillen/codeplug-studio/issues/498)
**Branch:** `1265/pskillen/channel-editor-rework`
**Plan:** `tmp/features/channel-editor-rework/plan.md` (gitignored scratch — this file is the durable record)

## Shipped slices

| #   | Slice                                         | Commit     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fix false-dirty on new-entity editors         | `491898c9` | `base` snapshot moved into `useState(() => …)` in `ChannelEditor.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2   | Section ids + sticky jump-nav                 | `193aca55` | New `channelEditorSections.ts`, `useSectionScrollSpy.ts`; `SectionNav` gains `{id,label}` item form; sticky horizontal strip wired into `ChannelEditor.tsx`                                                                                                                                                                                                                                                                                                                                                          |
| 3   | Identity scoped to minimum; RF rename         | `8b133c24` | Identity now callsign + verify actions + name + read-only RX/TX/band summary (jump-links to RF) + mode chips; new "Names and notes" panel (abbreviation, comment, wire-name preview), `collapsible` on mobile; "Frequency" panel renamed "RF"                                                                                                                                                                                                                                                                        |
| 4   | Callsign-first import on New channel          | `59f248bb` | `RepeaterListingUpdateDialog` two-button split (`onApplyAndSave` / `onApplyAndContinue`, required) + `mode: 'verify' \| 'lookup'`; `ChannelDirectoryVerifyActions` threads both through, gate at `ChannelEditor.tsx:298` removed; New channel gets `applyDirectoryPatch` (fan-out, no save) and `handleApplyAndSave` (navigates to the new row, mirrors `handleDuplicate`); alert copy reworded to distinguish lookup-by-callsign from browse-a-directory                                                            |
| 5   | Segmented control layout + value-aware colour | `519891aa` | `segmentColorsForOptions` fits the palette to non-neutral values only (`gradientSegmentedSchemes.ts`, +tests); `GradientSegmentedControl` gains `layout: 'stack' \| 'row'` and `neutralValues` (default `['default']`); six wrappers drop hardcoded `fullWidth`, gain `layout`; `DmrOperatingModeSegment` passes `neutralValues={['auto']}`; `ChannelModeProfilesEditor` and `ChannelEditor`'s RF panel pass `layout="row"`; styleguide demo added to Forms page                                                     |
| 6   | Connective tissue                             | (pending)  | `ChannelDirectoryVerifyActions` buttons move to a CSS grid (`repeat(auto-fit, minmax(190px, 1fr))`) instead of a wrapping flex row; **Title case names** checkbox moves to its own row, relabelled to name what it affects; `ChannelLocationSection` drops its hardcoded directory-verify hint, `ChannelEditor` renders a conditional "Set from a directory in Identity" jump-link instead (only when callsign is set and location is empty); `ChannelZoneMembershipSection` adds a "Not in a zone yet." empty state |

## Next

Continue with slice 7 per the plan. Update this table at every commit checkpoint.

## Verify steps

- `/library/channels/new` → Cancel immediately → no "Discard unsaved changes?" prompt.
- Jump-nav scrolls to and highlights Identity / Names and notes / RF / Mode settings / Location / (Zones) / Scanning / APRS.
- Identity's RX/TX/band summary line jump-links to RF.
- `/library/channels/new`: type a callsign, **Look up on ukrepeater.net** (or another source), confirm dialog titled "Import from directory"; **Apply only** fills the form without navigating or writing to IndexedDB; **Apply & save** creates the channel and lands on its edit page.
- Existing saved channel: **Apply & save** behaves exactly as before this PR (one click, saved, editor reflects the update).
- RF panel's Transmit/TX permit and Mode settings' squelch/DMR-mode/talker-alias controls render at intrinsic width (`layout="row"`) instead of full-width single-column, on desktop; collapse back to full-width stacked on mobile.
- Every "Default"/"Auto" pill across those controls renders with no colour override; previously-collapsed pairs (Allow TX vs RX only; On vs Off) render distinct colours.
- Identity's directory-check buttons settle into a predictable grid at desktop widths (no uneven flex-wrap); Title case names checkbox sits below the buttons, not inline.
- Location panel, on a channel with a callsign and no location, shows "Set from a directory in Identity" and jumps there on click.
- Zones panel, on a channel in no zone, shows "Not in a zone yet." above the Add-to-zone combobox.
