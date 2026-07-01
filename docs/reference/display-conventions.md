# Display conventions

Shared rules for how values are shown in the UI.

## Frequencies (MHz)

Library channels store RX/TX frequencies as Hz internally (`rxFrequencyHz`, `txFrequencyHz` on `Channel`).

When displayed:

- **kHz-aligned** values are shown with **three decimal places**, e.g. `145.775 MHz`.
- **Sub-kHz** values keep enough decimal places to preserve the stored value (at least three), e.g. `10.150250 MHz`.

> **Studio note:** A shared `formatFrequencyMhz()` helper is planned for `src/app/lib/`; until then routes format ad hoc.

## Bands

Band labels use definitions in [bands.md](./bands.md). Lookup covers UK amateur allocations and common non-amateur receive services (broadcast, airband, marine, PMR446) as rows are added to `src/core/domain/bandPlan.ts`.

| Category | Pill style | When shown |
| --- | --- | --- |
| Amateur (`amateur`) | Solid fill, white label text | Frequency in an Ofcom amateur allocation |
| Non-amateur (`broadcast`, `airband`, `marine`, `pmr`) | Outline, coloured border and label | Frequency in a documented service range |

When RX and TX fall on different bands, show one pill per band (split operation). Unknown frequency: no pill or "—".

**Disambiguation:** broadcast LW (148.5–285 kHz) and amateur 136 kHz (135.7–137.8 kHz) use different IDs and colours — see the disambiguation table in [bands.md](./bands.md).

## Channel modes

Mode pills and map marker colours use definitions in [channel-modes.md](./channel-modes.md) via `src/app/lib/channelModes.ts`.

## Channel naming

> **Studio note:** Wire-name composition and import split are **Phase 4+** (import/export). Until then, `Channel.name` is the display label; CPS wire naming rules live in [callsigns.md](./callsigns.md) and per-format channel docs.

| Field / control | Rule |
| --- | --- |
| **Callsign** | Repeater search key; map marker label when set |
| **Name** | Human qualifier in lists and detail — not the composed CPS wire string |
| **Comment** | Internal notes; not exported to CPS |

## Icons

The SPA uses [Tabler Icons](https://tabler.io/icons) via `@tabler/icons-react` — the set Mantine documents and examples use.

### Sizes and stroke

Shared constants live in `src/app/lib/iconSizes.ts`:

| Constant | Value | Use |
| --- | --- | --- |
| `ICON_SIZE_NAV` | 16 | Navbar `NavLink`, back links, inline anchors |
| `ICON_SIZE_ACTION` | 18 | `ActionIcon`, compact buttons |
| `ICON_STROKE` | 1.5 | All Tabler icons |

### When to use icons

- **Do:** navigation, primary actions (New, Edit, Delete, Save, Import, Export), icon-only controls with `aria-label`.
- **Don't:** table cells, `Badge`/band pills, mode labels, checkbox labels, or section headers unless they clearly aid grouping.

Pass icons via Mantine `leftSection` (or `rightSection` for forward arrows) and **keep the text label**.

### Imports

Import icons by name per file — e.g. `import { IconSettings } from '@tabler/icons-react'`. Do not barrel-re-export from a shared icons module (hurts tree-shaking).

## Two-section navigation

Desktop (`sm+`): primary column (`AppNav`, ~260px) + secondary column (`SectionNav`, ~220px). Mobile: primary in burger drawer; secondary renders as a toolbar above route content.

Registry: `src/app/nav/sectionNavRegistry.ts` maps pathname prefixes to section components under `src/app/components/SectionNav/sections/`. Filter state prefers URL search params where implemented.

## Related

- [app-shell](../features/app-shell/README.md)
