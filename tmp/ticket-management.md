# Gaps

> Agent instructions:
> These should become github tickets
> These are all in the context of @codeplug-studio/docs/poc-migration/epic-1-context.md, read that first
> "[NEW]" tickets should be created
> "[MIGRATE]" tickets should be pulled from the old `codeplug-tool` repo, adapted for this new project, and created in the new repo
> when done, add the ticket numbers (not the URL) inside parenthesis to the item, and remove the action prefix
> e.g. "Zones > Add/Edit - copy the two list layout of the old repo (#123)"

## Epic: Channel and zone management (#179)

Phase 2b library organisation — related umbrella [#52](https://github.com/pskillen/codeplug-studio/issues/52).

- bug: prevent circular nested zone configuration in UI (cf #157) (#188)

## Epic: Common import / export improvements (#184)

- refactor(ui): format export wire preview — skip-from-export toggle instead of include (#185)
- feat(builds): per-build force-export override for library export skips (e.g. `omitFromExport`) — pairs with #185 (#186)
- bug(core): graceful handling of circular nested zones at flatten/assemble (#187)

## Epic: 2b UI improvements (#52)

- bug: Radio build > channels > find a channel with m*n repeater-tg expansion, the default name does not use the channel abbv even though enabled and set (#150)
- feat(app): unsaved-changes guard on library add/edit forms (#189)
- feat(library): delete UI for all library entity types (#202)
- feat(library): bulk edit channels from list — scan inclusion, forbid TX, power, squelch (#207)
- bug(app): channel editor Location tab — map container reused on tab switch (#208)

## Epic: Usage and analytics (#96)

**Shipped** in PR branch `96/pskil/usage-analytics` — closes #96, #97, #98, #173, #174, #175, #176 (partial #162 Playwright scaffold).

- Cookies banner, cookies/privacy/terms pages, consent API (#98)
- Integrate Google Analytics (GA4, consent-gated) (#97)
- feat(analytics): Sanitize page paths before GA4 page_view (#173)
- chore(build): Dual GA measurement IDs — prod + pre-prod via Cloudflare Pages CI (#174)
- chore(docs): Refresh epic #96 and #97 for Cloudflare Pages and BrowserRouter (#175)
- test: Cookie consent banner smoke — Playwright (#176)
- ops (no ticket): Create **two** GA4 properties/streams (prod + pre-prod); add `GA_MEASUREMENT_ID` and `GA_MEASUREMENT_ID_PREPROD` GitHub Actions secrets; review data retention defaults

**Proposed follow-ups (`[NEW]` — not yet tickets):**

- [NEW] feat(analytics): workflow milestone events — `project_created`, `native_yaml_import`, `cps_export` with `formatId`/`profileId` only (no entity ids/counts)
- [NEW] feat(analytics): consent choice event — anonymous `analytics_consent_accepted` / `analytics_consent_declined` for opt-in rate tracking
- [NEW] feat(analytics): deploy environment dimension — attach `__BUILD_ENV__` to page_view params to segment dev vs next vs staging within the shared pre-prod GA property
- [NEW] feat(analytics): navigation click events — primary nav + section nav interactions beyond passive page_view
- [NEW] test(e2e): post-consent GA page_view smoke — network interception asserting sanitized template path after navigation
- [NEW] chore(docs): GA4 Explorations dashboard guide — operator doc for funnel reports (library → build → export) from sanitized routes
- [NEW] defer(analytics): Core Web Vitals via GA4 — only if `web-vitals` bundle cost is acceptable

## Epic: New library features (#147)

- export ordering/grouping — migrated from codeplug-tool#162 (#155)
- quick TX offset buttons on channel edit + offset display (+/- MHz or ===) — migrated from codeplug-tool#51 (#156)
- read/write YAML and CPS in OneDrive — migrated from codeplug-tool#16 (#159)
- read/write YAML and CPS in Dropbox — migrated from codeplug-tool#15 (#158)
- feat(library): tri-state scan inclusion and per-format export defaults (CHIRP driver) (#203)
- refactor(model): collapse `ssb-usb` and `ssb-lsb` into `ssb` with USB/LSB sideband setting on analog profile (#204)

## Epic: Internationalisation (#205)

**Parked** — epic only; child tickets not created yet.

## Epic: Future features (#148)

This epic is a parking spot for future feature ideas which haven't been fully realised yet

- vision: editing at point of use — modernise library CRUD UX (codeplug-tool#165 + #166 combined; slated to become epic when investigated) (#160)

## Epic 5 DM32 export #37

- bug: Zone derived scan lists were shipped in ticket 129 / pr 137, but there's no UI to enable them and they're never exported in Channels.csv or Scan.csv (#152)

## Epic: Testing and QA (#161)

- Playwright test framework and initial smoke tests (#162)
- library CRUD and map smoke tests (#164)
- radio build UI smoke tests — vendor-neutral (#165)
- OpenGD77 import and export smoke (#166)
- DM32 export ZIP smoke (#167)
- CHIRP export smoke — blocked on Phase 6 (#168)
- reference tools smoke tests (#169)

## Misc

- Ensure there's a proper component for the sub navbar - sections at top, section specific links below divider (child of #67 tech debt) (#153)
