# WritePartRow

## Purpose

One part in the Write stepper's "What to write" list (#1393): a tick, a title, a summary line, and options that appear only while the part is ticked. Reusable for any "tick what to include" list.

## Props

| Prop              | Type                         | Description                                    |
| ----------------- | ---------------------------- | ---------------------------------------------- |
| `title`           | `string`                     | Part name; also the checkbox's accessible name |
| `summary`         | `ReactNode`                  | One line under the title                       |
| `checked`         | `boolean`                    | Ticked                                         |
| `onCheckedChange` | `(checked: boolean) => void` | Tick handler                                   |
| `disabled`        | `boolean`                    | Disable the tick                               |
| `children`        | `ReactNode`                  | Options, rendered only when `checked`          |

## Usage

```tsx
<WritePartRow title="Digital contacts" summary="Replaces the radio's contact list" checked={on} onCheckedChange={setOn}>
  <SegmentedControl … />
</WritePartRow>
```

## Behaviour

- The AT-D890UV's **Radio settings** row is the one that can be disabled: no session changes means unticked, disabled, and _Set up…_ in the summary.
- Options never render while unticked, so a part's choices cannot be changed without including it.
- The part helpers (`writeButtonLabel`, `DEFAULT_WRITE_PARTS`, `clampPartsToSupport`) live in `writeParts.ts`.

## Related

- [`RadioWriteStepper`](./RadioWriteStepper.md)
- [radio-read-write hub](../../../../../docs/features/radio-read-write/README.md)
