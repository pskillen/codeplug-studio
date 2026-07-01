# Reference tools

Standalone amateur-radio helpers at `/reference` — a Maidenhead locator converter, a frequency → band lookup, and a band-plan table. For programming convenience only; not authoritative for on-air operation.

**Tracking:** Phase 2 [#12](https://github.com/pskillen/codeplug-studio/issues/12) (Epic [#1](https://github.com/pskillen/codeplug-studio/issues/1)) · shipped in [PR #15](https://github.com/pskillen/codeplug-studio/pull/15)

**Source:** `src/app/routes/ReferencePage.tsx`, `src/core/domain/maidenhead.ts`, `src/core/domain/bandPlan.ts`

## Implementation status

| Tool                              | Status  | Notes                                      |
| --------------------------------- | ------- | ------------------------------------------ |
| Maidenhead: locator → coordinates | Shipped | `locatorToCoords` (4/6/8-char)             |
| Maidenhead: coordinates → locator | Shipped | `coordsToLocator` (6-char output)          |
| Frequency → band                  | Shipped | `bandLabelForFrequencyHz` (MHz input)      |
| Band-plan table                   | Shipped | `BAND_PLAN` — UK amateur + common services |

## Concepts

The page needs no active project — it is a pure calculator over `core` domain helpers:

- **Maidenhead** (`src/core/domain/maidenhead.ts`) — `isValidLocator`, `locatorToCoords`, `coordsToLocator`. The same helpers derive channel locations when importing from [repeater directories](../repeater-directories/README.md).
- **Band plan** (`src/core/domain/bandPlan.ts`) — `BAND_PLAN` allocations plus `bandForFrequencyHz` / `bandLabelForFrequencyHz`, also used by [reports](../reports/README.md) and the [map](../map-and-repeaters/README.md).

These are tier-2 domain facts (RF/amateur, no CPS wire values); the page behaviour is tier-1. No format wire tables belong here.

## Documentation map

| Doc                                                 | Role                              |
| --------------------------------------------------- | --------------------------------- |
| [reports](../reports/README.md)                     | Reuses band lookup for breakdowns |
| [map-and-repeaters](../map-and-repeaters/README.md) | Uses Maidenhead to place markers  |

## Manual verify

1. Visit `/reference` (no active project required).
2. Enter `IO91WM` → coordinates near London appear; enter a lat/lon → a 6-char locator appears.
3. Enter `439.0` in Frequency → band shows `70CM`.

## Known gaps

- Band plan is a curated subset (UK-centric), not the full RSGB/Ofcom plan.
- No microwave bands above 23cm yet.
