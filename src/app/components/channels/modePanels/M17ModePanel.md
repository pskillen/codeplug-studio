# M17 mode panel

## Purpose

Edit a channel's M17 access and destination settings, and see the radio-wide callsign.

## Props

| Prop      | Type                                          | Description                                       |
| --------- | --------------------------------------------- | ------------------------------------------------- |
| `profile` | `ProfileFor<'m17'>`                           | Current M17 settings                              |
| `onPatch` | `(patch: Partial<ProfileFor<'m17'>>) => void` | Applies a field edit to the channel draft         |
| `context` | `ModePanelContext`                            | Supplies the library for the default M17 callsign |

## Usage

Render through the mode registry.

```tsx
<ModePanel profile={profile} onPatch={onPatch} context={context} />
```

## Behaviour

- **Access** holds CAN and **Play every CAN**. CAN accepts whole numbers from 0 to 15. A blank CAN uses 0.
- **Call** holds destination text. The input keeps the draft while typing and canonicalises valid text on blur. Blank, `ALL` and `@ALL` mean broadcast. Invalid CAN and destination values show field errors and block channel saves.
- **Listen** shows whether the channel plays matches to its own CAN or all CANs.
- **You** shows the read-only default M17 callsign and links to **Digital IDs**.

## Related

- [Library and Digital IDs](../../../../../docs/features/library/README.md#digital-ids)
- [Mode panels](ModePanels.md)
