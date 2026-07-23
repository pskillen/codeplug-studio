# preferNeonPlugPathwayBadges

Short Badge pills for New build format and profile cards that steer operators toward NeonPlug.

## Purpose

Surface the same product guidance as the export alerts earlier in the workflow — when choosing a CPS format or radio profile — without blocking selection.

## Exports

| Helper                | When                                                   | Tone                       |
| --------------------- | ------------------------------------------------------ | -------------------------- |
| `formatPathwayBadge`  | `dm32` → Prefer NeonPlug; `neonplug` → Recommended     | orange warning / blue info |
| `profilePathwayBadge` | `dm32-*` → Prefer NeonPlug; `neonplug-*` → Recommended | orange / blue              |

## Usage

```tsx
import { formatPathwayBadge, profilePathwayBadge } from './preferNeonPlugPathwayBadges.tsx';

{
  formatPathwayBadge(format.id);
}
{
  profilePathwayBadge(profile.profileId);
}
```

## Related

- [`NewBuildPage.tsx`](../../routes/builds/NewBuildPage.tsx)
- [`ProfilePicker.tsx`](ProfilePicker.tsx)
- [`Dm32PreferNeonPlugAlert.tsx`](Dm32PreferNeonPlugAlert.tsx)
