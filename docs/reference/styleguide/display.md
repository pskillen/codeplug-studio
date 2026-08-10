# Display conventions

Shared rules for **how values and chrome affordances are shown** in the UI. Part of the [UI interaction styleguide](README.md).

For list shells and Sort… / reorder, see [lists-and-ordering.md](lists-and-ordering.md). For operator-facing wording, see [help writing styleguide](../writing-styleguide/help-writing-styleguide.md).

## Frequencies (MHz)

Library channels store RX/TX frequencies as Hz internally (`rxFrequency` / related fields on `Channel`).

When displayed:

- **kHz-aligned** values are shown with **three decimal places**, e.g. `145.775 MHz`.
- **Sub-kHz** values keep enough decimal places to preserve the stored value (at least three), e.g. `10.150250 MHz`.

> **Studio note:** Prefer shared helpers under `src/app/lib/` (e.g. frequency formatters) over ad hoc per-route formatting when touching display code.

## Bands

Band labels use definitions in [bands.md](../bands.md). Lookup covers UK amateur allocations and common non-amateur receive services (broadcast, airband, marine, PMR446) as rows are added to `src/core/domain/bandPlan.ts`.

| Category                                              | Pill style                         | When shown                               |
| ----------------------------------------------------- | ---------------------------------- | ---------------------------------------- |
| Amateur (`amateur`)                                   | Solid fill, white label text       | Frequency in an Ofcom amateur allocation |
| Non-amateur (`broadcast`, `airband`, `marine`, `pmr`) | Outline, coloured border and label | Frequency in a documented service range  |

When RX and TX fall on different bands, show one pill per band (split operation). Unknown frequency: no pill or "—".

**Disambiguation:** broadcast LW (148.5–285 kHz) and amateur 136 kHz (135.7–137.8 kHz) use different IDs and colours — see the disambiguation table in [bands.md](../bands.md).

## Channel modes

Mode pills and map marker colours use definitions in [channel-modes.md](../channel-modes.md) via `src/app/lib/channelModes.ts`.

## Channel naming

Wire-name composition for CPS export lives at the import/export boundary. In library UI:

| Field / control | Rule                                                                   |
| --------------- | ---------------------------------------------------------------------- |
| **Callsign**    | Repeater search key; map marker label when set                         |
| **Name**        | Human qualifier in lists and detail — not the composed CPS wire string |
| **Comment**     | Internal notes; not exported to CPS                                    |

CPS wire naming rules: [callsigns.md](../callsigns.md) and per-format channel docs under `docs/reference/export-formats/<format>/`.

## Icons

The SPA uses [Tabler Icons](https://tabler.io/icons) via `@tabler/icons-react` — the set Mantine documents and examples use.

### Sizes and stroke

Shared constants live in `src/app/lib/iconSizes.ts`:

| Constant           | Value | Use                                          |
| ------------------ | ----- | -------------------------------------------- |
| `ICON_SIZE_NAV`    | 16    | Navbar `NavLink`, back links, inline anchors |
| `ICON_SIZE_ACTION` | 18    | `ActionIcon`, compact buttons                |
| `ICON_STROKE`      | 1.5   | All Tabler icons                             |

Membership **remove from list** and entity **delete** both use trash at `ICON_SIZE_NAV` — see [README — Remove from list vs delete](README.md#remove-from-list-vs-delete-entity).

### When to use icons

- **Do:** navigation, primary actions (New, Edit, Delete, Save, Import, Export), icon-only controls with `aria-label`.
- **Don't:** table cells, `Badge`/band pills, mode labels, checkbox labels, or section headers unless they clearly aid grouping.

Pass icons via Mantine `leftSection` (or `rightSection` for forward arrows) and **keep the text label**.

### Imports

Import icons by name per file — e.g. `import { IconSettings } from '@tabler/icons-react'`. Do not barrel-re-export from a shared icons module (hurts tree-shaking).

## Primary + contextual navigation

Desktop (`sm+`): v2 `AppShell` top tabs. Narrow viewports: `BottomTabBar` instead of the tab row — elevated chrome (accent top border, upward shadow, surface background) so primary nav is discoverable ([#962](https://github.com/pskillen/codeplug-studio/issues/962)). Section sub-views use a horizontally scrollable `ContextualStrip` (Library entity types, Tools, Help, build detail, …).

Wide `DataTable` (v2) layouts scroll horizontally inside the table shell on narrow viewports; flexible columns keep an `8rem` min floor so overflow engages ([#962](https://github.com/pskillen/codeplug-studio/issues/962)). Page horizontal gutters tighten on narrow viewports (`--dsv2-page-padding-x`: 12px at ≤48em, 32px above) so tables reclaim usable width ([#1024](https://github.com/pskillen/codeplug-studio/issues/1024)).

Strip destinations: `src/app/nav/contextualStripItems.ts` and `useBuildContextualStrip` for trait-shaped build nav. Filter state prefers URL search params where implemented.

Strip labels should match list page titles ([README — Page shells](README.md#page-shells)) where they describe the same destinations.

Shared entity icons: `src/app/nav/entityNavIcons.ts`; build-only icons are set on `buildNavItems` in `src/app/routes/builds/nav.ts`.

## Related

- [Styleguide hub](README.md)
- [Lists and ordering](lists-and-ordering.md)
- [bands.md](../bands.md) · [channel-modes.md](../channel-modes.md) · [callsigns.md](../callsigns.md)
- [app-shell](../../features/app-shell/README.md)
