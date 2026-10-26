# AtD890WriteCoverageTable

## Purpose

Shows AT-D890UV operators which parts of the radio **Write** updates from their library, which are **not supported yet** (use Anytone CSV), and which are **left alone** on the cable path. Rendered on **Export** when the Web Serial pathway is active, inside the **What Write updates** section of `BuildRadioIoPanel`, which is collapsed by default (the table mounts only when opened).

## Props

| Prop                   | Type      | Description                                               |
| ---------------------- | --------- | --------------------------------------------------------- |
| `buildId`              | `string`  | Build id for the **Radio image** deep-dive link           |
| `hasHydration?`        | `boolean` | When true, shows link to retained-region map after a Read |
| `mm9pdy?`              | `boolean` | MM9PDY target: the channel positions row reads "Updated"  |
| `settingsChangeCount?` | `number`  | Radio settings fields set this session                    |

## Usage

```tsx
<AtD890WriteCoverageTable buildId={build.id} hasHydration={hasHydration} />
```

## Behaviour

- Static rows from `atD890WriteCoverageRows(mm9pdy)` in `writeCoverage.ts` (no hex addresses). Channel positions are left alone on the stock target and written on the MM9PDY target ([#1383](https://github.com/pskillen/codeplug-studio/issues/1383)).
- Status labels with icons: check (updated from library), cross (not supported yet), minus (left alone), violet check (satellite keps — updated via the separate **Satellite keps** tab's Write Keps trigger, #859/#1085, not this Write).
- Copy follows the [help writing styleguide](../../../docs/reference/writing-styleguide/help-writing-styleguide.md).
- The **Radio settings** row reads "Preserved, except N fields you set" when the session has changes (otherwise "Carried through erase unchanged").
- Does not gate Write — informational only.

## Related

- [`BuildRadioIoPanel.md`](./BuildRadioIoPanel.md)
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [AT-D890UV Write contract](../../../docs/reference/radios/anytone/at-d890uv/README.md)
