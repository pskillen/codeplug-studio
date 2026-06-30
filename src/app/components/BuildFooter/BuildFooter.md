# BuildFooter

Muted page footer showing build environment and version injected at compile time.

## Purpose

Lets operators and contributors see which deployment a browser tab is running (`local` vs `prod`) and which release tag was baked in.

## Props

None.

## Usage

```tsx
import BuildFooter from './components/BuildFooter/BuildFooter.tsx';

<BuildFooter />;
```

## Behaviour

Reads `__BUILD_ENV__` and `__BUILD_VERSION__` from Vite `define` (see `.cursor/skills/version-number/SKILL.md`).

## Related

- [docs/build/README.md](../../../../docs/build/README.md)
- [vite.config.ts](../../../../vite.config.ts)
