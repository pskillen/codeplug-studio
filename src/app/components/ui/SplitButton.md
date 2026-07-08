# SplitButton

## Purpose

Primary action button with a chevron menu for secondary actions. Adapted from [Mantine UI — Split button](https://ui.mantine.dev/category/buttons/#split-button).

## Props

| Prop        | Type                     | Description                      |
| ----------- | ------------------------ | -------------------------------- |
| `label`     | `string`                 | Primary button label             |
| `onClick`   | `() => void`             | Primary action                   |
| `menuItems` | `SplitButtonMenuItem[]`  | Secondary actions in dropdown    |
| `loading`   | `boolean`                | Primary button loading state     |
| `disabled`  | `boolean`                | Disables primary and menu        |
| `variant`   | Mantine `Button` variant | Default `light`                  |
| `size`      | Mantine `Button` size    | Default `xs`                     |
| `fullWidth` | `boolean`                | Stretch primary segment in a row |

## Usage

```tsx
import SplitButton from '@app/components/ui/SplitButton.tsx';

<SplitButton
  label="Add channels"
  onClick={() => addChannels()}
  menuItems={[{ label: 'Add as zone', onClick: () => addAsZone() }]}
/>;
```
