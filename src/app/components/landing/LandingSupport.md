# LandingSupport

Empty-state landing for Home (`/` with no projects): hero with `LandingPathChooser`, `RadioFinder`, `RadioSupportMatrix`.

## Props

| Prop               | Type         | Notes                                 |
| ------------------ | ------------ | ------------------------------------- |
| `onStartFromRadio` | `() => void` | Opens the Start from my radio wizard  |
| `onStartProject`   | `() => void` | Opens the New project dialog          |
| `onOpenDrive`      | `() => void` | Opens the Google Drive file browser   |
| `onImport`         | `() => void` | Scrolls to the project file drop zone |

## Usage

```tsx
<LandingSupport
  onStartFromRadio={() => navigate('/start/radio')}
  onStartProject={() => setNewProjectOpen(true)}
  onOpenDrive={openFromDrive}
  onImport={scrollToImport}
/>
```

## Behaviour

Builds rows once with `buildSupportMatrix({ availability: supportMatrixAvailability() })`, so cells reflect this site's Write, satellite keps, and flasher gating. Claims in the hero copy must stay true to shipped behaviour.

## Related

[Onboarding hub](../../../../docs/features/onboarding/README.md), [radio catalog](../../../../docs/features/builds/radio-catalog.md#support-matrix-landing-page).
