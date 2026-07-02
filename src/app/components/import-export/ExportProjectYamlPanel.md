Export the active project to a downloadable native YAML file.

## Purpose

Operator control for full-project backup — filename pre-fill from `ProjectMeta.interchange.localFile` when present.

## Props

None — reads active project from `useProjects()`.

## Usage

```tsx
<ExportProjectYamlPanel />
```

## Behaviour

- Suggests filename via `suggestExportDestination` or `defaultLocalExportFileName`
- Calls `exportProjectToYaml` with `recordDestination: 'localFile'`
- Triggers browser download via `downloadBlob`
- Refreshes project list so interchange metadata updates in context

## Related

- [import-export/native-yaml](../../../../docs/features/import-export/native-yaml/README.md)
