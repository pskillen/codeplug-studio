# ActiveProjectBar

Active project name and **Switch** control in the primary sidebar.

## Purpose

Shows the current project label and navigates back to the project picker on **Switch**.

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `onNavClick` | `() => void` | Optional — closes the mobile nav drawer (same as other `AppNav` links) |

## Usage

```tsx
<ActiveProjectBar onNavClick={closeDrawer} />
```

## Behaviour

- Renders nothing when no active project
- **Switch** calls `onNavClick` then navigates to `/`

## Related

- [AppNav.tsx](../AppNav/AppNav.tsx)
- [app-shell/README.md](../../../../docs/features/app-shell/README.md)
