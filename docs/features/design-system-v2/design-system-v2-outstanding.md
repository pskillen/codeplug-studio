# Design system v2 — Outstanding

Debt and follow-ups discovered during [epic #915](https://github.com/pskillen/codeplug-studio/issues/915).

## Debt

| Item                                          | Severity | Notes                                                                                                                                                      |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MapPanel` still hatch placeholder            | Deferred | Real `CodeplugMap` wiring tracked as [#925](https://github.com/pskillen/codeplug-studio/issues/925) — Zones/Channels/Summary still embed raw `CodeplugMap` |
| Domain BandPill / ModePill in membership rows | Low      | Zone/RGL/scan shuttle rows still use v1 `BandPill` / `ModePill` inside `ShuttleRow` labels — acceptable until domain pills re-skin                         |
| Mantine segments in v2 editors                | Low      | Talk group / digital contact mode pickers and APRS sub-panels still use v1 `GradientSegmentedControl` / Mantine tabs inside v2 shells                      |
| `ZoneEditActions.tsx` unused                  | Low      | Save moved to layout sticky header — file can be removed in #927 retire pass                                                                               |
| Cookie banner vs BottomTabBar overlap         | Low      | Fixed cookie dialog may sit over the mobile tab bar until a dedicated offset lands                                                                         |

## Closed during library ports

- ShuttleList skins only in styleguide — now wired in `ZoneMemberEditor`, `RxGroupListMemberPicker`, `ScanListMemberEditor`
- Epic #915 exclusion of TG / Contacts / Scan / APRS — shipped as best-effort chrome ports ([#932](https://github.com/pskillen/codeplug-studio/issues/932)–[#935](https://github.com/pskillen/codeplug-studio/issues/935))
