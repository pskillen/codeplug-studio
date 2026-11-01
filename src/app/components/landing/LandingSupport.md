# LandingSupport

Empty-state landing for Home (`/` with no projects): hero, `RadioFinder`, `RadioSupportMatrix`.

## Props

| Prop             | Type         | Notes                        |
| ---------------- | ------------ | ---------------------------- |
| `onStartProject` | `() => void` | Opens the New project dialog |
| `onImport`       | `() => void` | Scrolls to Import from YAML  |

## Usage

```tsx
<LandingSupport onStartProject={() => setNewProjectOpen(true)} onImport={scrollToImport} />
```

## Behaviour

Builds rows once with `buildSupportMatrix({ availability: supportMatrixAvailability() })`, so cells reflect this site's Write and flasher gating. Claims in the hero copy must stay true to shipped behaviour.

## Related

[Onboarding hub](../../../../docs/features/onboarding/README.md), [radio catalog](../../../../docs/features/builds/radio-catalog.md#support-matrix-landing-page).
