Import a native YAML file as a **new** project from the Home page.

## Purpose

Create a project from an offline backup without replacing an existing IndexedDB project.

## Props

None.

## Usage

```tsx
<ImportProjectYamlPanel />
```

## Behaviour

- `importProjectFromYaml` with `createNew` — fresh `projectId` on all rows
- Switches active project and navigates to `/summary` on success
- Surfaces parse/validation errors in an `Alert`

## Related

- [import-export/native-yaml](../../../../docs/features/import-export/native-yaml/README.md)
