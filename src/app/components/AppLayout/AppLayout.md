# AppLayout

Top-level application frame: header with brand + primary navigation, the routed content `Outlet`, and the shared `BuildFooter`.

## Purpose

Provides consistent chrome and navigation across every Phase 2 surface (Projects, Library, Map, Reports, Settings, Help) and surfaces the active project in the header.

## Props

None. Rendered as a layout route element; child routes render through `<Outlet />`.

## Usage

```tsx
<Route element={<AppLayout />}>
  <Route path="/" element={<HomePage />} />
  {/* … */}
</Route>
```

## Behaviour

- Reads the active project from `useProjects()` to show "Active project: …" (or "No active project").
- `NavLink` highlights the current route; the Projects link uses `end` so it only matches `/`.

## Related

- [ProjectProvider](../../state/ProjectProvider.tsx) / [useProjects](../../state/useProjects.ts)
- [BuildFooter](../BuildFooter/BuildFooter.md)
- [docs/features/app-shell/README.md](../../../../docs/features/app-shell/README.md)
