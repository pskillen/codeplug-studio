# FileDropzone

Drag/drop + click-to-browse file input, collapsing to a selected-file row once a file is chosen.

## Purpose

Generic file intake — project YAML import, channel-set upload, and similar single/multi-file pickers. Generalized from the retired v1 `YamlFileDropzone` drag/drop mechanics.

## Props

| Prop              | Type                      | Notes                                                        |
| ----------------- | ------------------------- | ------------------------------------------------------------ |
| `label`           | `string`                  | Default `Drop a file here, or click to browse`               |
| `hint`            | `string`                  |                                                              |
| `accept`          | `string`                  | Passed through to the native file input                      |
| `multiple`        | `boolean`                 |                                                              |
| `onFilesSelected` | `(files: File[]) => void` | Required                                                     |
| `fileName`        | `string`                  | When set, collapses to a selected-file row showing this name |
| `onClear`         | `() => void`              | Remove-file action on the selected-file row                  |
| `error`           | `string`                  |                                                              |
| `disabled`        | `boolean`                 |                                                              |

## Usage

```tsx
import { DesignSystemV2Provider, FileDropzone } from '@app/components/v2';

<DesignSystemV2Provider>
  <FileDropzone
    label="Drop a project YAML here"
    accept=".yaml,.yml"
    fileName={selectedFile?.name}
    onFilesSelected={([file]) => handleFile(file)}
    onClear={() => setSelectedFile(null)}
  />
</DesignSystemV2Provider>;
```

## Behaviour

- Must render inside `DesignSystemV2Provider`.
- Two states, driven by whether `fileName` is set: empty dropzone (dashed border, drag-over highlight, click-or-drop, keyboard-accessible via `role="button"` + Enter/Space) vs. selected-file row (bordered, success icon, filename, remove action).
- This component only surfaces raw `File` objects — reading file contents (e.g. `readTextFile`) and validating extension/type stays the consumer's job.
- Live demos: `/styleguide/forms`

## Related

- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md)
