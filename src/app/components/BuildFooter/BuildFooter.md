# BuildFooter

Muted page footer showing build environment and version injected at compile time.

## Purpose

Lets operators and contributors see which deployment a browser tab is running (`local`, `next`, `dev`, `staging`, or `prod`) and which version was baked in.

## Props

None.

## Usage

```tsx
import BuildFooter from './components/BuildFooter/BuildFooter.tsx';

<BuildFooter />;
```

## Behaviour

Reads `__BUILD_ENV__` and `__BUILD_VERSION__` from Vite `define` (see `.cursor/skills/version-number/SKILL.md`).

Muted **Repository** and **Report a bug** links point at shared constants in `src/app/lib/githubLinks.ts` and open in a new tab (`rel="noreferrer"`).

## Related

- [docs/build/README.md](../../../../docs/build/README.md)
- [docs/features/app-shell/README.md](../../../../docs/features/app-shell/README.md)
- [vite.config.ts](../../../../vite.config.ts)
