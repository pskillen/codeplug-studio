# ModeSection

Collapsible editor section for one channel mode: **Main mode** badge or **Make main**, mode-colour stripe, and a folded one-line summary.

## Purpose

With two or more modes on a channel, the **Modes** block renders one `ModeSection` per profile (in profile order). The section wraps v2 `Panel` so operators can fold secondary modes while keeping the main mode open.

## Props

| Prop               | Type          | Notes                                                        |
| ------------------ | ------------- | ------------------------------------------------------------ |
| `mode`             | `ChannelMode` | Which mode this section edits                                |
| `isMain`           | `boolean`     | When true, shows **Main mode**; otherwise **Make main**      |
| `onMakeMain`       | `() => void`  | Sets `primaryMode` for this mode (does not reorder profiles) |
| `summary`          | `string`      | One-line folded summary; empty shows "Nothing set yet"       |
| `defaultCollapsed` | `boolean`     | Initial fold state (from `modeSectionStartsFolded`)          |
| `children`         | `ReactNode`   | Typically `ModePanel` for this profile                       |

## Usage

```tsx
import ModeSection, { modeSectionStartsFolded } from '@app/components/channels/ModeSection';

<ModeSection
  mode="dmr"
  isMain={primary === 'dmr'}
  onMakeMain={() => setModeEdit((e) => setChannelMainMode(e, 'dmr'))}
  summary={modeProfileSummary(profile, library)}
  defaultCollapsed={modeSectionStartsFolded({
    modeCount,
    compact: isMobile,
    isMain: primary === 'dmr',
    addedThisEdit: addedModes.has('dmr'),
  })}
>
  <ModePanel profile={profile} onPatch={…} context={…} />
</ModeSection>;
```

## Behaviour

- **Main mode** is a `Pill` with `tone="accent"`; other sections use a ghost **Make main** button. Both sit in the panel `actions` slot (outside the collapse toggle).
- Hover or focus on either control explains main mode in plain words (no radio or format names).
- A 4px left stripe uses `modeColor(mode)`.
- Fold rule: `modeSectionStartsFolded` — with three or more modes (or two on a phone), non-main sections start folded unless they were added during this edit; the main mode always starts open.
- While folded, `summary` (or "Nothing set yet") appears under the title.
- Making a mode main never reorders sections; remove modes from chips, not from the section header.

## Related

- [Panel.md](../v2/Panel.md) — `actions` header slot
- [modePanels/ModePanels.md](./modePanels/ModePanels.md)
- [ChannelModePicker.md](./ChannelModePicker.md)
- [channel-modes.md](../../../../docs/features/library/channel-modes.md)
