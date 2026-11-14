# BuildFooter

Muted page footer showing build environment and version injected at compile time.

## Purpose

Lets operators and contributors see which deployment a browser tab is running (`local`, `next`, `dev`, `staging`, or `prod`) and which version was baked in. Links to legal pages and GitHub feedback.

## Props

None.

## Usage

```tsx
import BuildFooter from './components/BuildFooter/BuildFooter.tsx';

<BuildFooter />;
```

## Behaviour

Reads `__BUILD_ENV__` and `__BUILD_VERSION__` from Vite `define` (see the `version-number` skill (pskillen/agent-skills)).

The version text is also the [**developer mode**](../../../../docs/features/developer-mode/README.md) gesture: five taps in a row (each within 2 s of the last) turn developer mode on for this device. From the second tap a short toast at the top of the screen (clear of the footer, so it never covers the version being tapped) counts down ("3 more taps to turn on developer mode") and the fifth confirms it. Taps never turn it off: while it is on they only say so and point at the top bar's chip. `e2e/developer-mode-toast.spec.ts` checks the toast never overlaps the version at phone width and on desktop. The tap logic is pure, in `src/app/services/developerModeTaps.ts`. The text looks unchanged; for assistive tech it is a button labelled with the version.

In-app **Cookies**, **Privacy**, and **Terms** links use React Router (`Link`). **Repository** and **Report a bug** use external anchors from `src/app/lib/githubLinks.ts` (`target="_blank"`, `rel="noreferrer"`).

## Related

- [docs/features/developer-mode/README.md](../../../../docs/features/developer-mode/README.md)
- [DeveloperModeBadge](../DeveloperModeBadge/DeveloperModeBadge.md)
- [docs/build/README.md](../../../../docs/build/README.md)
- [docs/features/app-shell/README.md](../../../../docs/features/app-shell/README.md)
- [docs/features/analytics/README.md](../../../../docs/features/analytics/README.md)
- [vite.config.ts](../../../../vite.config.ts)
