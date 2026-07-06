# GradientSegmentedControl

## Purpose

Full-width segmented control with an optional **per-segment indicator colour** — the sliding thumb takes the active segment's colour (with a short fade on change). Generic form primitive for two- to five-value choices; channel transmit permission uses the `allowForbid` preset via `ForbidTransmitSegment`.

## Props

| Prop            | Type                                                 | Description                                                |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| `label`         | `ReactNode`                                          | Optional `Input.Wrapper` label                             |
| `description`   | `ReactNode`                                          | Optional field description                                 |
| `value`         | `string`                                             | Selected segment value                                     |
| `onChange`      | `(value: string) => void`                            | Selection handler                                          |
| `data`          | `GradientSegmentOption[]`                            | `{ value, label, disabled? }` per segment                  |
| `scheme`        | `GradientSegmentSchemeName \| GradientSegmentScheme` | Named preset or custom palette. Omit for plain Mantine UI. |
| `segmentColors` | `readonly string[]`                                  | Override colours (Mantine names or CSS). Length ≈ `data`.  |
| `fullWidth`     | `boolean`                                            | Stretch to parent width                                    |
| `disabled`      | `boolean`                                            | Disable all segments                                       |
| `size`          | `MantineSize`                                        | Forwarded to Mantine `SegmentedControl`                    |

## Presets (`gradientSegmentedSchemes.ts`)

| Export / key  | Segments | Use case                         |
| ------------- | -------- | -------------------------------- |
| `onOff`       | 2        | Generic on/off, enabled/disabled |
| `allowForbid` | 2        | Allow vs restrict (channel TX)   |
| `three`       | 3        | Three-way choice                 |
| `four`        | 4        | Four-way choice                  |
| `five`        | 5        | Five-way choice                  |

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
- Mantine `--sc-color` updates when the selection changes; the indicator fades to the new segment colour over the same duration as the slide animation.
- `autoContrast` is enabled when a colour scheme is applied.
- Without `scheme` or `segmentColors`, renders a standard Mantine `SegmentedControl`.

## Related

- [ForbidTransmitSegment](../channels/ForbidTransmitSegment.md) — channel TX wrapper
- [App shell feature hub](../../../../docs/features/app-shell/README.md)
- Dev demos: `/styleguide`
