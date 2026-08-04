# AppLayout

Top-level application frame: v2 `AppShell` + optional `ContextualStrip` + mobile `BottomTabBar`, with routed content `Outlet` and `BuildFooter` still under the v1 theme.

## Purpose

Design-system chrome port ([#917](https://github.com/pskillen/codeplug-studio/issues/917)): one top bar and an optional pill strip instead of the former double sidebar. Page content inside `<Outlet/>` stays on the v1 theme until Phase 3 screen ports.

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

- Chrome region wraps in `DesignSystemV2Provider`; banners, `<Outlet/>`, and footer stay outside (intentional v2-header / v1-content seam).
- Primary tabs: Summary, Library, Tools (`/reference`), Export for radio, Help. Project-scoped tabs hide when no project is active; Tools and Help remain.
- Project chip navigates home (`/`) to switch projects. Drive save/check sits in `rightExtra`. Settings and Debug live in the avatar overflow menu.
- `ContextualStrip` shows Library / Tools / Help / Settings / Debug / build-detail sub-routes. Build detail also mounts compact `BuildSwitcher` as the strip leading control.
- Below Mantine `sm` (768px), top tabs hide and `BottomTabBar` mirrors the same destinations. The shell locks to `100dvh` with scrollable `<main>` so the tab bar stays on the viewport (not the document end).
- `DriveRefreshProvider` wraps the shell so Drive controls and `RefreshFromDriveBanner` share remote-check state.
- `RequireActiveProject` still gates library / summary / builds routes.

## Related

- [AppShell](../v2/AppShell.md) · [ContextualStrip](../v2/ContextualStrip.md) · [BottomTabBar](../v2/BottomTabBar.md)
- [docs/features/app-shell](../../../../docs/features/app-shell/README.md)
- [docs/features/design-system-v2](../../../../docs/features/design-system-v2/README.md)
