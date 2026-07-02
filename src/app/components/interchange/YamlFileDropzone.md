Single-file drag-or-click target for native YAML interchange (`.yaml` / `.yml`).

## Purpose

Shared file picker for import panels — reads text via `readTextFile` and delegates parsing to the parent.

## Props

| Prop         | Type                                        | Description                                           |
| ------------ | ------------------------------------------- | ----------------------------------------------------- |
| `onFileText` | `(text, fileName) => void \| Promise<void>` | Called with file contents after validation            |
| `error`      | `string \| null`                            | Optional external error (e.g. import service failure) |
| `disabled`   | `boolean`                                   | Disables interaction while parent is busy             |

## Usage

```tsx
<YamlFileDropzone onFileText={(text) => void importProjectFromYaml(text, { kind: 'createNew' })} />
```

## Behaviour

- Hidden `<input type="file" accept=".yaml,.yml">` plus drag-and-drop zone
- Rejects non-YAML extensions before read
- 10 MB size limit via `readTextFile`

## Related

- [import-export/native-yaml](../../../../docs/features/import-export/native-yaml/README.md)
