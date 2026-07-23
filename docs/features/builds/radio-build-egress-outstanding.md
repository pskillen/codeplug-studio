# RadioBuild + EgressPath — outstanding

**Tracking:** [#654](https://github.com/pskillen/codeplug-studio/issues/654) · PR [#657](https://github.com/pskillen/codeplug-studio/pull/657) · [#658](https://github.com/pskillen/codeplug-studio/issues/658)

Items discovered during execution (not the plan checklist).

## Open

_(none)_

## Resolved

- [x] Native YAML models `radioBuilds` + `egressPaths`; legacy `formatBuilds` dropped with warning.
- [x] `isDm32Build` matches any dm32-compatible egress on the radio target.
- [x] App UI uses egress-scoped `formatId` / `profileId` / `hydration`.
- [x] Contributor checklists + DESIGN + data-model aligned.
- [x] UI redo: radio-target create, radio-first list, active-egress retain nav, sticky default egress (was incomplete after first UI pass).
- [x] Export review polish: settings above pathway chooser; drop CHIRP “try NeonPlug” tip; keep DM32 deprecation; catalog-ordered egress with Web Serial default.
- [x] [#658](https://github.com/pskillen/codeplug-studio/issues/658) — Gate Export projection UI by `radioTargetId` traits (not active egress `profileId`); settings visibility must not change when switching pathways.
