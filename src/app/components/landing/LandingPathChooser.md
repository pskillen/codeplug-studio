# LandingPathChooser

The landing page's "ways in": four large cards, radio first.

## Purpose

Most new operators arrive with a programmed radio, not a plan for a library. The cards put **Start from my radio** first and make **Open from Google Drive** as easy to reach as starting a project, instead of leaving it at the foot of the page.

## Props

| Prop               | Type         | Notes                                                       |
| ------------------ | ------------ | ----------------------------------------------------------- |
| `onStartFromRadio` | `() => void` | Primary card; Home navigates to `/start/radio`              |
| `onStartProject`   | `() => void` | Opens the New project dialog                                |
| `onOpenDrive`      | `() => void` | Opens the Drive file browser, connecting to Drive if needed |
| `onImportFile`     | `() => void` | Takes the operator to the project file drop zone            |

## Usage

```tsx
<LandingPathChooser
  onStartFromRadio={() => navigate('/start/radio')}
  onStartProject={() => setNewProjectOpen(true)}
  onOpenDrive={openFromDrive}
  onImportFile={scrollToImport}
/>
```

## Behaviour

- Renders a `<nav aria-label="Get started">` of buttons; two columns on desktop, one on phones.
- Presentational: the page owns navigation, the Drive connection and the New project dialog.
- Must render inside `DesignSystemV2Provider` (uses `--dsv2-*` tokens).

## Related

[Onboarding hub — Path cards](../../../../docs/features/onboarding/README.md#path-cards), [LandingSupport](LandingSupport.md).
