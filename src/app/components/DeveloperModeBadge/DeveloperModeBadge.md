# DeveloperModeBadge

Top-bar chip that says "Developer mode" while developer mode is on for this device, with a one-tap ✕ to turn it off.

## Purpose

Developer mode shows features the prod site hides ([#1650](https://github.com/pskillen/codeplug-studio/issues/1650)).
The chip makes that visible on every screen, so a screenshot or a support question shows it.

## Props

None. Reads and writes developer mode through `useDeveloperMode`.

## Usage

```tsx
import DeveloperModeBadge from '../DeveloperModeBadge/DeveloperModeBadge.tsx';

<DeveloperModeBadge />;
```

## Behaviour

- Renders nothing while developer mode is off.
- The ✕ (`aria-label="Turn off developer mode"`) turns it off; prod-hidden features disappear at once.
- Shown on every build, not only prod: the switch is per device, and the chip says it is on.
- Must render inside `DesignSystemV2Provider` (uses `--dsv2-*` tokens). `AppLayout` places it in the top bar's
  `rightExtra` slot. Below 30em the label shortens to "Dev mode".

## Related

- [docs/features/developer-mode/README.md](../../../../docs/features/developer-mode/README.md)
- [BuildFooter](../BuildFooter/BuildFooter.md) — the five-tap gesture
- [AppLayout](../AppLayout/AppLayout.md)
