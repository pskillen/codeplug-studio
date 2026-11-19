Import a native YAML file as a **new** project from the Home page.

## Purpose

Create a project from an offline backup without replacing an existing IndexedDB project.

## Props

| Prop                | Type                      | Notes                                                                  |
| ------------------- | ------------------------- | ---------------------------------------------------------------------- |
| `driveOpen`         | `boolean`                 | Optional. Controls the Drive browser so the page can open it elsewhere |
| `onDriveOpenChange` | `(open: boolean) => void` | Optional. Called when the panel opens or closes the Drive browser      |

## Usage

```tsx
<ImportProjectYamlPanel />
// Home opens the same Drive browser from the landing path cards:
<ImportProjectYamlPanel driveOpen={driveOpen} onDriveOpenChange={setDriveOpen} />
```

## Behaviour

- `importProjectFromYaml` with `createNew` — fresh `projectId` on all rows
- Switches active project and navigates to `/summary` on success
- Surfaces parse/validation errors in an `Alert`

## Related

- [import-export/native-yaml](../../../../docs/features/import-export/native-yaml/README.md)
