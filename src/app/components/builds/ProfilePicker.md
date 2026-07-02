# ProfilePicker

Lists radio variant profiles for a CPS format — used when creating a build, editing a build target, or overriding profile at export time.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `formatId` | `FormatId` | CPS format (`opengd77`, `chirp`, …) |
| `value` | `string \| null` | Selected `profileId` (select mode) |
| `onChange` | `(profileId: string) => void` | Selection handler |
| `mode` | `'cards' \| 'select'` | Card list (new build) or dropdown (detail/export) |
| `label` | `string` | Select label |
| `description` | `string` | Select description |
| `disabled` | `boolean` | Disable interaction |

## Usage

```tsx
<ProfilePicker
  formatId="opengd77"
  mode="select"
  value={profileId}
  onChange={setProfileId}
  label="Export profile"
  description="Power ladder and wire limits for target hardware"
/>
```

## Behaviour

- OpenGD77 profiles show `nameLimit`, channel cap, and wire hints from `getFormatProfiles`.
- Other formats fall back to trait profile registry entries.
- Export override does not mutate the persisted build unless the operator saves on the Target section.

## Related

- [profiles.md](../../../../docs/features/builds/profiles.md)
- [builds README](../../../../docs/features/builds/README.md)
