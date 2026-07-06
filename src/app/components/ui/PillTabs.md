# PillTabs

## Purpose

Mantine `Tabs` wrapper with optional **leading pill/badge** in each tab label — used for per-mode profile editors and any tabbed UI where tabs need a colour swatch beside the title.

## Props

| Prop           | Type                      | Description                                 |
| -------------- | ------------------------- | ------------------------------------------- |
| `items`        | `PillTabsItem[]`          | Tab value, label, optional `leading`, panel |
| `defaultValue` | `string`                  | Initial tab when uncontrolled               |
| `value`        | `string`                  | Controlled active tab                       |
| `onChange`     | `(value: string) => void` | Tab change handler                          |
| `panelPt`      | `MantineSpacing`          | Panel top padding (default `md`)            |
| `emptyState`   | `ReactNode`               | Rendered when `items` is empty              |

### `PillTabsItem`

| Field     | Type        | Description                |
| --------- | ----------- | -------------------------- |
| `value`   | `string`    | Tab id                     |
| `label`   | `ReactNode` | Tab label text             |
| `leading` | `ReactNode` | Optional pill/badge prefix |
| `panel`   | `ReactNode` | Tab panel body             |

## Usage

```tsx
import { PillTabs } from '@app/components/ui/index.ts';
import ModePill from '@app/components/pills/ModePill.tsx';
import { modeLabel } from '@app/lib/channelModes.ts';

<PillTabs
  items={profiles.map((profile) => ({
    value: profile.mode,
    leading: <ModePill mode={profile.mode} size="xs" />,
    label: modeLabel(profile.mode),
    panel: <ModeProfileFields profile={profile} />,
  }))}
  emptyState={
    <Text size="sm" c="dimmed">
      Select a mode first.
    </Text>
  }
/>;
```

## Related

- [ChannelModeProfilesEditor](../channels/ChannelModeProfilesEditor.md)
- Dev demos: `/styleguide`
