# Onboarding & Quick start

Tier-1 reference for first-run getting-started on **Projects** (`/`) and the voluntary **Quick start** modal (also from **Help**).

**Tracking:** [#345](https://github.com/pskillen/codeplug-studio/issues/345) (parent epic [#344](https://github.com/pskillen/codeplug-studio/issues/344)); Start from my radio [#1921](https://github.com/pskillen/codeplug-studio/issues/1921)

**Source:** `src/app/components/onboarding/`, wired from `HomePage.tsx` and `HelpPage.tsx`

## Overview

New operators with an empty project list need the product thesis (library → format builds → export) and a clear path that prefers directories and curated sets over hand-typing every channel. Returning operators can reopen the same short guide without a forced tour.

User-facing copy follows the [help writing styleguide](../../reference/writing-styleguide/help-writing-styleguide.md): no spotlight tours, no modal the operator must dismiss to proceed.

## Implementation status

| Area                      | Status   | Notes                                                                                                                                                                         |
| ------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home section order        | Shipped  | New project → projects / empty guide → Import from YAML                                                                                                                       |
| Inline empty-state guide  | Shipped  | When `!loading && projects.length === 0`                                                                                                                                      |
| Quick start modal         | Shipped  | v2 `ModalShell` on Home + Help ([#939](https://github.com/pskillen/codeplug-studio/issues/939))                                                                               |
| Getting-started copy      | Shipped  | Directories-first fill, optional DMR shortcut, CPS differences, Reference footer                                                                                              |
| Help workflow alignment   | Shipped  | Builds + Add from… + Reference links                                                                                                                                          |
| Landing hero              | Shipped  | Empty state only: pitch, then path cards ([#1494](https://github.com/pskillen/codeplug-studio/issues/1494), [#1922](https://github.com/pskillen/codeplug-studio/issues/1922)) |
| Path cards                | Shipped  | Start from my radio, Start from scratch, Open from Google Drive, Import a project file ([#1922](https://github.com/pskillen/codeplug-studio/issues/1922))                     |
| Start from my radio       | Shipped  | `/start/radio` wizard: Radio → Name → Read → Next steps ([#1923](https://github.com/pskillen/codeplug-studio/issues/1923))                                                    |
| Radio-specific next steps | Shipped  | Derived from the read's radio target; never Write ([#1924](https://github.com/pskillen/codeplug-studio/issues/1924))                                                          |
| Radio finder              | Shipped  | Chip per catalog model, card per firmware, "Most features" highlight, swipeable cards on phones                                                                               |
| Compare all radios        | Shipped  | Model / firmware matrix, DMR / FM filter, legend; radio column pinned on small screens                                                                                        |
| "Why not the maker's CPS" | Deferred | Not every claim can be verified from the codebase; needs owner-reviewed wording                                                                                               |

## Landing page (no projects)

With zero projects, `/` leads with a short hero and four path cards, then **What radio have you got?** (the finder), then **Compare all radios** (the matrix), then the Quick start guide and Import from YAML. Desktop and phone show the same sections; on phones the chips and firmware cards scroll sideways and the matrix scrolls with its Radio column pinned.

The finder and matrix are a projection of the radio catalog, never a hand-kept table: see [Support matrix](../builds/radio-catalog.md#support-matrix-landing-page) for how each column is derived. Cells have four states: supported, partial, not supported, and not applicable (the radio hardware cannot do it, for example DMR columns on an FM radio). Stock firmware is always listed, with "Not supported" where Studio has no target for it (DM-1701, MD-9600). A flasher is only advertised when this site offers it.

### Path cards

The hero offers the ways into Studio, radio first:

| Card                       | Goes to                                                       |
| -------------------------- | ------------------------------------------------------------- |
| **Start from my radio**    | The [Start from my radio](#start-from-my-radio) wizard        |
| **Start from scratch**     | The New project dialog                                        |
| **Open from Google Drive** | The Drive file browser, connecting to Drive first when needed |
| **Import a project file**  | The project file drop zone at the foot of the page            |

With existing projects (`/?manage=1`), the **Your projects** header carries **Open from Drive** and **Read my radio** beside **Import project** and **New project**.

## Start from my radio

Most new operators arrive with a radio that is already programmed. They want to read it, change it (often to add zones), and write it back, without first learning about libraries and builds. `/start/radio` is a full-page wizard that needs no open project:

1. **Radio** — one card per radio model whose cable read can fill a library. The list is derived from the radio catalog and the radio adapters, so a radio appears once its adapter supports [Read into library](../radio-read-write/read-into-library.md).
2. **Name** — the project name, prefilled from the radio ("My UV-5R Mini").
3. **Read** — a short get-ready list and **Connect and read**. The port picker opens first; the project is created only once a radio is connected, then the read runs through the same pipeline as a build's **Read into library**. If the read fails, the project is kept and **Try again** reuses it rather than making a copy. Browsers without Web Serial see why the button is disabled.
4. **Next steps** — counts for channels, zones and firmware, then a list of next steps chosen for the radio that was read. A collapsed **Read details** panel holds the full read summary.

### Next steps

`readNextSteps` in core picks the steps from the read's radio target:

| Condition                                                                                                                  | Lead step                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| The target groups channels into zones                                                                                      | **Arrange your zones** (build zones page)                                        |
| The target runs stock firmware, a modded firmware for the same model adds zones, and this site offers the firmware flasher | **Update your radio's firmware** (flasher), with a note to read again afterwards |

Then always **Browse your channels** (library) and **Open your build**. The list never offers **Write to radio**: the operator has just read the radio and has nothing new to send yet. A radio that has zones on its stock firmware leads with **Arrange your zones** and never sees the firmware step.

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
| [LandingPathChooser.md](../../../src/app/components/landing/LandingPathChooser.md)          | Path cards sidecar                      |
| [Read into library](../radio-read-write/read-into-library.md)                               | What a read creates and updates         |
| [radio catalog / support matrix](../builds/radio-catalog.md#support-matrix-landing-page)    | Column derivation                       |
| [app-shell](../app-shell/README.md)                                                         | Home route + project lifecycle shell    |
| [operator lifecycle](../workflows/operator-lifecycle.md)                                    | Create / import / edit flow             |
| [repeater-directories](../repeater-directories/README.md)                                   | Add from… directory behaviour           |
| [multi-talkgroup expansion](../../reference/multi-talkgroup-expansion.md)                   | Export-time RGL expansion (contributor) |
| [zone-derived scan lists](../../reference/zone-derived-scan-lists.md)                       | Zone → scan projection (contributor)    |
| [reference tools](../reference/README.md)                                                   | Band plan + Maidenhead routes           |

## Code anchors

| Path                                                      | Role                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/app/components/onboarding/GettingStartedContent.tsx` | Shared guide body                                                    |
| `src/app/components/onboarding/GettingStartedFlow.tsx`    | Accessible numbered step list                                        |
| `src/app/components/onboarding/GettingStartedModal.tsx`   | Voluntary modal shell                                                |
| `src/app/routes/HomePage.tsx`                             | Landing (empty) + Quick start                                        |
| `src/app/components/landing/`                             | `LandingSupport`, `RadioFinder`, `RadioSupportMatrix`, `SupportMark` |
| `src/app/services/supportMatrixAvailability.ts`           | Site facts: Write gate, Read, flasher offered                        |
| `src/app/components/landing/LandingPathChooser.tsx`       | Landing path cards                                                   |
| `src/app/routes/start/StartFromRadioPage.tsx`             | Start from my radio wizard                                           |
| `src/app/services/startFromRadio.ts`                      | Readable radios, suggested name, flasher offered for a target        |
| `src/core/services/radioRead/readNextSteps.ts`            | Next steps after a first read (pure, tested)                         |
| `src/core/radio-targets/supportMatrix.ts`                 | `buildSupportMatrix` (pure, tested)                                  |
| `src/app/routes/HelpPage.tsx`                             | Getting started section + Quick start                                |

## Boundaries

- The guide is app-layer copy. The landing matrix is derived in core (`@core/radio-targets`); no radio literals in `src/app/`.
- Format-agnostic user copy — no CPS column names or profile caps in the guide.
- Does not deep-link into library routes until a project exists (`RequireActiveProject`).

## Related

- [DESIGN.md — Glossary](../../../DESIGN.md#glossary)
- [Help writing styleguide](../../reference/writing-styleguide/help-writing-styleguide.md)
