# ImageCheckbox

## Purpose

Card-style checkbox inspired by [Mantine UI — Checkbox with image](https://ui.mantine.dev/category/inputs/). Full-width clickable row with optional image or custom `media`, title, description, and a trailing checkbox. `ImageCheckboxGroup` lays out options in a `SimpleGrid` for multi-select fields.

## Components

| Export               | Role                                      |
| -------------------- | ----------------------------------------- |
| `ImageCheckbox`      | Single card toggle                        |
| `ImageCheckboxGroup` | Labelled grid; `value` / `onChange` array |

## Props — `ImageCheckbox`

| Prop          | Type                         | Description                          |
| ------------- | ---------------------------- | ------------------------------------ |
| `title`       | `ReactNode`                  | Primary label                        |
| `description` | `ReactNode`                  | Optional dimmed line above title     |
| `imageSrc`    | `string`                     | Optional 40×40 image                 |
| `imageAlt`    | `string`                     | Alt text for `imageSrc`              |
| `media`       | `ReactNode`                  | Leading slot when `imageSrc` omitted |
| `checked`     | `boolean`                    | Controlled state                     |
| `onChange`    | `(checked: boolean) => void` | Toggle handler                       |
| `disabled`    | `boolean`                    | Disable interaction                  |

## Props — `ImageCheckboxGroup`

| Prop          | Type                       | Description                  |
| ------------- | -------------------------- | ---------------------------- |
| `label`       | `ReactNode`                | `Input.Wrapper` label        |
| `description` | `ReactNode`                | Helper text                  |
| `value`       | `readonly T[]`             | Selected option values       |
| `onChange`    | `(value: T[]) => void`     | Selection change             |
| `options`     | `ImageCheckboxOption<T>[]` | Card definitions             |
| `cols`        | `SimpleGrid` cols          | Default `{ base: 1, sm: 2 }` |

## Usage

```tsx
import { ImageCheckboxGroup } from '@app/components/ui/index.ts';
import ModePill from '@app/components/pills/ModePill.tsx';

<ImageCheckboxGroup
  label="Modes"
  value={selectedModes}
  onChange={setSelectedModes}
  options={[
    {
      value: 'fm',
      title: 'FM',
      description: 'Analog',
      media: <ModePill mode="fm" size="xs" />,
    },
  ]}
/>;
```

## Related

- [ChannelModesMultiSelect](../channels/ChannelModesMultiSelect.md)
- Dev demos: `/styleguide`
