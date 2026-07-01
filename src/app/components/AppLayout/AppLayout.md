# AppLayout

Top-level application frame: Mantine `AppShell` with header, primary nav (`AppNav`), optional section nav (`SectionNav`), routed content `Outlet`, and `BuildFooter`.

## Purpose

Provides consistent chrome matching the codeplug-tool UI kit: two-section sidebar on desktop, section toolbar on mobile, dark theme, and project switching via `ActiveProjectBar`.

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

- Primary nav shows **Projects** when no active project; **Library / Summary / Map** when a project is selected.
- Section nav appears on `/library`, `/help`, `/reference`, `/settings` (and library sub-routes). Channel repeater import actions live in the library section nav.
- `RequireActiveProject` gates library, summary, and map routes.

## Related

- [AppNav](../AppNav/AppNav.tsx) · [SectionNav](../SectionNav/SectionNav.tsx)
- [ui kit](../ui/index.ts) · [docs/features/app-shell](../../../../docs/features/app-shell/README.md)
