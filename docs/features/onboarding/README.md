# Onboarding & Quick start

Tier-1 reference for first-run getting-started on **Projects** (`/`) and the voluntary **Quick start** modal (also from **Help**).

**Tracking:** [#345](https://github.com/pskillen/codeplug-studio/issues/345) (parent epic [#344](https://github.com/pskillen/codeplug-studio/issues/344))

**Source:** `src/app/components/onboarding/`, wired from `HomePage.tsx` and `HelpPage.tsx`

## Overview

New operators with an empty project list need the product thesis (library → format builds → export) and a clear path that prefers directories and curated sets over hand-typing every channel. Returning operators can reopen the same short guide without a forced tour.

User-facing copy follows the [help writing styleguide](../../reference/writing-styleguide/help-writing-styleguide.md): no spotlight tours, no modal the operator must dismiss to proceed.

## Implementation status

| Area                     | Status  | Notes                                                                            |
| ------------------------ | ------- | -------------------------------------------------------------------------------- |
| Home section order       | Shipped | New project → projects / empty guide → Import from YAML                          |
| Inline empty-state guide | Shipped | When `!loading && projects.length === 0`                                         |
| Quick start modal        | Shipped | Home + Help header actions; operator-opened only                                 |
| Getting-started copy     | Shipped | Directories-first fill, optional DMR shortcut, CPS differences, Reference footer |
| Help workflow alignment  | Shipped | Builds + Add from… + Reference links                                             |

## When the guide shows

| Surface                    | Condition                                                      |
| -------------------------- | -------------------------------------------------------------- |
| Inline on `/`              | Zero projects after list load                                  |
| Modal from **Quick start** | Always available on Projects and Help when the operator clicks |

Once at least one project exists, the inline panel is hidden; **Quick start** remains.

## Copy outline (product)

1. **Main path** — create project → fill library → format build → export for vendor CPS
2. **Fill your library** — **Channels** → **Add from…**: ukrepeater.net, RepeaterBook, BrandMeister, curated sets; hand-entry optional
3. **Optional DMR shortcut** — directory repeater → open channel → BrandMeister talk groups / RX group list
4. **How Studio differs from a typical CPS** — multi-mode library channels; no hand-multiplying repeater×talk-group rows (RX group list + export expansion); zone-derived scan lists when the radio separates zones and scan lists
5. **Also useful** — links to **Band plan** and **Maidenhead locator** under **Reference** (outside the main workflow)

## Documentation map

| Doc                                                                                         | Contents                                |
| ------------------------------------------------------------------------------------------- | --------------------------------------- |
| [GettingStartedContent.md](../../../src/app/components/onboarding/GettingStartedContent.md) | Component sidecar                       |
| [app-shell](../app-shell/README.md)                                                         | Home route + project lifecycle shell    |
| [operator lifecycle](../workflows/operator-lifecycle.md)                                    | Create / import / edit flow             |
| [repeater-directories](../repeater-directories/README.md)                                   | Add from… directory behaviour           |
| [multi-talkgroup expansion](../../reference/multi-talkgroup-expansion.md)                   | Export-time RGL expansion (contributor) |
| [zone-derived scan lists](../../reference/zone-derived-scan-lists.md)                       | Zone → scan projection (contributor)    |
| [reference tools](../reference/README.md)                                                   | Band plan + Maidenhead routes           |

## Code anchors

| Path                                                      | Role                                  |
| --------------------------------------------------------- | ------------------------------------- |
| `src/app/components/onboarding/GettingStartedContent.tsx` | Shared guide body                     |
| `src/app/components/onboarding/GettingStartedFlow.tsx`    | Accessible numbered step list         |
| `src/app/components/onboarding/GettingStartedModal.tsx`   | Voluntary modal shell                 |
| `src/app/routes/HomePage.tsx`                             | Inline empty state + Quick start      |
| `src/app/routes/HelpPage.tsx`                             | Getting started section + Quick start |

## Boundaries

- App-layer UI and copy only; no core/integrations changes.
- Format-agnostic user copy — no CPS column names or profile caps in the guide.
- Does not deep-link into library routes until a project exists (`RequireActiveProject`).

## Related

- [DESIGN.md — Glossary](../../../DESIGN.md#glossary)
- [Help writing styleguide](../../reference/writing-styleguide/help-writing-styleguide.md)
