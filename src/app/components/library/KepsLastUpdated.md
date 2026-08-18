# KepsLastUpdated

## Purpose

Shows when the project's satellite keps library was last refreshed from CelesTrak/AMSAT (`ProjectMeta.satelliteLibraryLastUpdated`). Uses a seven-day stale treatment (warning colour) matching [feature-design.md](../../../../docs/features/satellite-keps/feature-design.md) §7.

Not TLE `epoch` or per-row `updatedAt`.

## Props

| Prop          | Type                          | Notes                                                                  |
| ------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `iso`         | `string \| null \| undefined` | Last successful bulk keps refresh timestamp                            |
| `libraryHref` | `string`                      | Optional — appends an "Update in Library" link (omit on the list page) |

## Usage

```tsx
import KepsLastUpdated from '@app/components/library/KepsLastUpdated.tsx';

<KepsLastUpdated iso={activeProject?.satelliteLibraryLastUpdated} />
<KepsLastUpdated
  iso={activeProject?.satelliteLibraryLastUpdated}
  libraryHref="/library/satellite-keps"
/>
```

## Behaviour

- `Never refreshed` when `iso` is missing or invalid — always stale styling.
- `Last updated: {locale}` when set; stale after seven days (`formatKepsLastUpdated` in `src/app/lib/kepsLastUpdated.ts`).
- Optional library link for surfaces that cannot run **Update from CelesTrak/AMSAT** themselves.

## Related

- [satellite-keps hub](../../../../docs/features/satellite-keps/README.md)
- [WriteRadioModal.md](../builds/WriteRadioModal.md)
