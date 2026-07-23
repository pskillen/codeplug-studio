# WebSerialExperimentalAlert

## Purpose

Orange warning on **Direct radio** (Web Serial) Export chrome: browser write is experimental and riskier than established CPS tools until each adapter is marked stable.

## Props

None.

## Usage

```tsx
formatId === 'radio-io' ? <WebSerialExperimentalAlert /> : null;
// or inside BuildRadioIoPanel:
<WebSerialExperimentalAlert />;
```

## Behaviour

- Orange Mantine `Alert` — same weight as `Dm32PreferNeonPlugAlert`.
- Does not block Read/Write controls.
- Copy follows [help writing styleguide](../../../docs/reference/writing-styleguide/help-writing-styleguide.md).

## Related

- [`BuildRadioIoPanel.tsx`](BuildRadioIoPanel.tsx) — mounts this alert
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [`Dm32PreferNeonPlugAlert.tsx`](Dm32PreferNeonPlugAlert.tsx) — sibling Export warning pattern
