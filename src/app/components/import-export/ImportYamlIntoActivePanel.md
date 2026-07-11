Replace the **active** project from a native YAML file (with confirmation).

## Purpose

Full-project restore on the Import / export route — wipes library and format-build rows via `replaceProject`.

## Props

None — requires an active project from `useProjects()`.

## Usage

```tsx
<ImportYamlIntoActivePanel />
```

## Behaviour

- Dropzone queues file text; Mantine `Modal` blocks replace until operator confirms
- `importProjectFromYaml` with `replaceExisting` when YAML `project.id` matches the active project
- When ids differ, modal offers **Replace local content** (`adoptRemote`) or **Import as new project**
- Import failures surface in the modal (not console-only)
- Refreshes project metadata after success

## Related

- [import-export/native-yaml](../../../../docs/features/import-export/native-yaml/README.md)
