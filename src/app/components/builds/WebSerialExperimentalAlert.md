# WebSerialExperimentalAlert

## Purpose

Orange warning on the **Backup / Restore** page (Web Serial): browser write is experimental and riskier than established CPS tools until each adapter is marked stable.

## Props

None.

## Usage

```tsx
<WebSerialExperimentalAlert />
```

## Behaviour

- Orange Mantine `Alert` — same weight as `Dm32PreferNeonPlugAlert`.
- Does not block Read/Write controls.
- Copy follows [help writing styleguide](../../../docs/reference/writing-styleguide/help-writing-styleguide.md).

## Related

- [`BuildRadioBackupPage.tsx`](../../routes/builds/BuildRadioBackupPage.tsx) — mounts this alert. The Export panel (`BuildRadioIoPanel.tsx`) no longer does: it shows the one-line `ExperimentalNote` with a link, so Export has no stacked alerts
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [`Dm32PreferNeonPlugAlert.tsx`](Dm32PreferNeonPlugAlert.tsx) — sibling Export warning pattern
