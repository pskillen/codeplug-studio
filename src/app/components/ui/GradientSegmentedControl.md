# GradientSegmentedControl

## Purpose

Segmented control with an optional **value-aware per-segment indicator colour** — the sliding thumb takes the active segment's colour (with a short fade on change), and a neutral option (e.g. "Default"/"Auto") deliberately gets no colour override rather than inheriting whatever the palette had left over. Generic form primitive for two- to five-value choices; channel transmit permission uses the `allowForbid` preset via `ForbidTransmitSegment`.

## Props

| Prop            | Type                                                 | Description                                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`         | `ReactNode`                                          | Optional label (position depends on `layout`)                                                                                                                                                                                                      |
| `description`   | `ReactNode`                                          | Optional field description                                                                                                                                                                                                                         |
| `value`         | `string`                                             | Selected segment value                                                                                                                                                                                                                             |
| `onChange`      | `(value: string) => void`                            | Selection handler                                                                                                                                                                                                                                  |
| `data`          | `GradientSegmentOption[]`                            | `{ value, label, disabled? }` per segment                                                                                                                                                                                                          |
| `scheme`        | `GradientSegmentSchemeName \| GradientSegmentScheme` | Named preset or custom palette. Omit for plain Mantine UI.                                                                                                                                                                                         |
| `segmentColors` | `readonly string[]`                                  | Explicit override colours (Mantine names or CSS), positional — length ≈ `data`. Bypasses `neutralValues` fitting.                                                                                                                                  |
| `neutralValues` | `readonly string[]` (default `['default']`)          | Option values excluded from palette fitting and rendered with no colour override. Pass `[]` to disable, or override (e.g. `['auto']`).                                                                                                             |
| `layout`        | `'stack' \| 'row'` (default `'stack'`)               | `'stack'` — label/description above the control (today's layout). `'row'` — label/description left, control right at intrinsic width, collapsing to full-width stacking below the app's shared mobile breakpoint (`MOBILE_MAX_WIDTH_MEDIA_QUERY`). |
| `fullWidth`     | `boolean`                                            | Stretch to parent width. Respected for `layout='stack'`; ignored for `layout='row'` (row decides width from viewport instead).                                                                                                                     |
| `disabled`      | `boolean`                                            | Disable all segments                                                                                                                                                                                                                               |
| `size`          | `MantineSize`                                        | Forwarded to Mantine `SegmentedControl`                                                                                                                                                                                                            |

## Presets (`gradientSegmentedSchemes.ts`)

| Export / key   | Segments | Use case                                   |
| -------------- | -------- | ------------------------------------------ |
| `onOff`        | 2        | Generic on/off, enabled/disabled           |
| `allowForbid`  | 2        | Allow vs restrict (channel TX)             |
| `three`        | 3        | Three-way choice                           |
| `four`         | 4        | Four-way choice                            |
| `five`         | 5        | Five-way choice                            |
| `digitalModes` | 7        | Digital channel modes (`ModePill` colours) |

## Usage

```tsx
import { GradientSegmentedControl, GRADIENT_SEGMENT_SCHEMES } from '@app/components/ui/index.ts';

<GradientSegmentedControl
  label="Transmit"
  value={txMode}
  onChange={setTxMode}
  scheme="allowForbid"
  fullWidth
  data={[
    { value: 'allow', label: 'Allow TX' },
    { value: 'forbid', label: 'RX only' },
  ]}
/>;
```

Row layout with a neutral "Default" option (the common wrapper-component shape):

```tsx
<GradientSegmentedControl
  label="TX permit"
  value={txPermit}
  onChange={setTxPermit}
  scheme="three"
  layout="row"
  data={[
    { value: 'default', label: 'Default' },
    { value: 'permitAlways', label: 'Permit always' },
    { value: 'busyLock', label: 'Busy lock' },
  ]}
/>
```

Custom palette:

```tsx
<GradientSegmentedControl
  value={level}
  onChange={setLevel}
  segmentColors={['gray', 'yellow', 'orange', 'red']}
  data={[
    { value: 'low', label: 'Low' },
    { value: 'med', label: 'Med' },
    { value: 'high', label: 'High' },
    { value: 'max', label: 'Max' },
  ]}
/>
```

## Behaviour

- Track uses the default Mantine segmented-control background.
- **Colour fitting is value-aware, not positional.** `segmentColorsForOptions` fits the scheme's palette to the count of _non-neutral_ values only, then splices the neutral positions back in as "no override". Previously, a short palette padded with its last colour to match segment count — inserting a neutral "Default" often pushed a real option onto the same colour as an unrelated one (or the same colour as the neutral itself). That's fixed for every caller that leaves `neutralValues` at its default (`['default']`); a wrapper spelling its neutral option something else (`DmrOperatingModeSegment`'s `'auto'`) passes `neutralValues={['auto']}`.
- A neutral value's indicator renders with **no `--sc-color` override** — Mantine's own default indicator colour — rather than a fixed "dimmed" token.
- Mantine `--sc-color` updates when the selection changes; the indicator fades to the new segment colour over the same duration as the slide animation.
- `autoContrast` is enabled when a colour scheme is applied.
- Without `scheme` or `segmentColors`, renders a standard Mantine `SegmentedControl`.
- `layout="row"` uses `useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY)` to force full-width stacking on mobile — no CSS-only collapse, since Mantine's `SegmentedControl` needs the `fullWidth` prop itself to flex its segments evenly.

## Related

- [ForbidTransmitSegment](../channels/ForbidTransmitSegment.md) — channel TX wrapper
- [App shell feature hub](../../../../docs/features/app-shell/README.md)
- Dev demos: `/styleguide`
