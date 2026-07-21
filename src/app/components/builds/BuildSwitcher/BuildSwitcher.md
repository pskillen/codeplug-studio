# BuildSwitcher

Current format-build identity and sibling switcher in build secondary nav chrome.

## Purpose

Makes the active build obvious (name + format/profile cue) and lets operators jump to another build without climbing back to the Export for radio list.

## Props

None — reads the build id from the route and the project build list from `useFormatBuilds`.

## Usage

```tsx
import BuildSwitcher from '../../builds/BuildSwitcher/BuildSwitcher.tsx';

<BuildSwitcher />;
```

Mounted from `BuildSectionNavFrame` above `BuildNavLinks`.

## Behaviour

- Renders nothing when the current build cannot be resolved
- **Select** lists sibling builds **grouped by CPS format** (muted group headers; catalog order; name-sorted within each group); changing selection navigates via `pathForSwitchedBuild`
- Preserves the current sub-route when the target build exposes that nav item; otherwise lands on `/export`
- Shows format · profile under the select as a read-only cue

## Related

- [builds/README.md](../../../../../docs/features/builds/README.md)
- [BuildSectionNavFrame.tsx](../../SectionNav/sections/BuildSectionNavFrame.tsx)
- [nav.ts](../../../routes/builds/nav.ts) — `pathForSwitchedBuild`
