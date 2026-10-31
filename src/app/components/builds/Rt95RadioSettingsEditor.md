# Rt95RadioSettingsEditor

## Purpose

Body of the RT95 Radio settings page: Read a radio, sections of CPS fields with Keep / Set, advanced panel, and sticky footer. State is in `rt95RadioSettingsSession` (session-only).

## Props

| Prop      | Type         | Notes                      |
| --------- | ------------ | -------------------------- |
| `buildId` | `string`     | Session store key          |
| `egress`  | `EgressPath` | Web Serial egress for Read |

## Usage

```tsx
<Rt95RadioSettingsEditor buildId={build.id} egress={egress} />
```

## Behaviour

Same interaction model as the AT-D890 editor: Keep / Set, Copy all, Clear all, advanced switch with discard confirm, **Write settings…** (opens Export stepper with Radio settings only). See [RT95 settings reference](../../../../docs/reference/radios/retevis/rt95/settings.md).

## Related

- [Rt95RadioSettingRow](./Rt95RadioSettingRow.md)
- [Rt95RadioSettingsReadButton](./Rt95RadioSettingsReadButton.md)
