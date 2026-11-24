# useRadioWriteDialog

## Purpose

Reusable Write dialog shell for any page that has a `RadioBuild` and a Web Serial `EgressPath`: mounts `RadioWriteStepper` on `EgressShell`, the verify-report modal, and exposes `open` / `busy`.

## Props (hook args)

| Arg                  | Type                                | Description                                           |
| -------------------- | ----------------------------------- | ----------------------------------------------------- |
| `build`              | `RadioBuild`                        | Build whose overrides and settings feed the stepper   |
| `egress`             | `EgressPath`                        | Active Web Serial pathway                             |
| `onOpenSettingsPage` | `() => void` optional               | AT-D890 / RT95 “Review its settings” navigation       |

## Usage

```tsx
const writeDialog = useRadioWriteDialog({
  build,
  egress,
  onOpenSettingsPage: () => navigate(`/builds/${build.id}/export/radio-settings`),
});

<Button onClick={() => writeDialog.open()}>Write radio…</Button>
{writeDialog.element}
```

Keps-only:

```tsx
writeDialog.open({ codeplug: false, contacts: false, settings: false, keps: true });
```

## Behaviour

- Builds `WriteStepperConfig` (keps summary, channel location note, AT-D890/RT95 settings rows, TG step keys) the same way `BuildRadioIoPanel` did before extraction.
- Opens the verify-report modal when the flow finishes with a check result.
- `busy` tracks the stepper session for navigation guards.

## Related

- [BuildRadioIoPanel](../BuildRadioIoPanel.md)
- [RadioWriteStepper](../RadioWriteStepper/RadioWriteStepper.md)
- [Satellite keps](../../../../docs/features/satellite-keps/README.md)