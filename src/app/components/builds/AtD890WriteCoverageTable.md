# AtD890WriteCoverageTable

## Purpose

Shows AT-D890UV operators which parts of the radio **Write** updates from their library, which are **not supported yet** (use Anytone CSV), and which are **left alone** on the cable path. Rendered on **Export** when the Web Serial pathway is active.

## Props

| Prop            | Type      | Description                                               |
| --------------- | --------- | --------------------------------------------------------- |
| `buildId`       | `string`  | Build id for the **Radio image** deep-dive link           |
| `hasHydration?` | `boolean` | When true, shows link to retained-region map after a Read |

## Usage

```tsx
<AtD890WriteCoverageTable buildId={build.id} hasHydration={hasHydration} />
```

## Behaviour

- Static rows from `AT_D890_WRITE_COVERAGE_ROWS` in `writeCoverage.ts` (no hex addresses).
- Status labels with icons: check (updated from library), cross (not supported yet), minus (left alone).
- Copy follows the [help writing styleguide](../../../docs/reference/writing-styleguide/help-writing-styleguide.md).
- Does not gate Write — informational only.

## Related

- [`BuildRadioIoPanel.md`](./BuildRadioIoPanel.md)
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [AT-D890UV Write contract](../../../docs/reference/radios/anytone/at-d890uv/README.md)
