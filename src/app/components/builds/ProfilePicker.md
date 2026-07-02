# ProfilePicker

Lists radio variant profiles for a CPS format — used when creating a build or editing the build Target section.

## Props

| Prop          | Type                          | Description                                      |
| ------------- | ----------------------------- | ------------------------------------------------ |
| `formatId`    | `FormatId`                    | CPS format (`opengd77`, `chirp`, …)              |
| `value`       | `string \| null`              | Selected `profileId` (select mode)               |
| `onChange`    | `(profileId: string) => void` | Selection handler                                |
| `mode`        | `'cards' \| 'select'`         | Card list (new build) or dropdown (build detail) |
| `label`       | `string`                      | Select label                                     |
| `description` | `string`                      | Select description                               |
| `disabled`    | `boolean`                     | Disable interaction                              |

## Usage

```tsx
<ProfilePicker
  formatId="opengd77"
  mode="select"
  value={profileId}
  onChange={setProfileId}
  label="Radio profile"
  description="Trait profile and wire limits for this build"
/>
```

## Behaviour

- OpenGD77 profiles show `nameLimit`, channel cap, and wire hints from `getFormatProfiles`.
- Other formats fall back to trait profile registry entries.
- CPS export uses the saved build `profileId` — change profile in Target, not on the export panel.

## Related

- [profiles.md](../../../../docs/features/builds/profiles.md)
- [builds README](../../../../docs/features/builds/README.md)
