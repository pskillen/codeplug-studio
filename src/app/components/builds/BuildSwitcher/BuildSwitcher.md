# BuildSwitcher

Current radio-build identity and sibling switcher in build chrome.

## Purpose

Makes the active build obvious (name + radio-target cue) and lets operators jump to another build without climbing back to the builds list.

## Props

| Prop      | Type      | Notes                                                                 |
| --------- | --------- | --------------------------------------------------------------------- |
| `compact` | `boolean` | Leading control for v2 `ContextualStrip` — narrow select, no cue text |

## Usage

```tsx
import BuildSwitcher from '../../builds/BuildSwitcher/BuildSwitcher.tsx';

<BuildSwitcher />
<BuildSwitcher compact />
```

Mounted as the leading control on build-detail `ContextualStrip` rows (`compact`).

## Behaviour

- Renders nothing when the current build cannot be resolved
- **Select** lists sibling builds **grouped by manufacturer / family**; changing selection navigates via `pathForSwitchedBuild`
- Preserves the current sub-route when the target build exposes that nav item; otherwise lands on `/export`
- Non-compact shows the catalog radio-target label under the select

## Related

- [builds/README.md](../../../../../docs/features/builds/README.md)
- [AppLayout.md](../../AppLayout/AppLayout.md)
- [nav.ts](../../../routes/builds/nav.ts) — `pathForSwitchedBuild`
