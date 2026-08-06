# ProjectYamlFileDropzone

## Purpose

Native YAML project import dropzone — v2 `FileDropzone` with `.yaml`/`.yml` accept, size guard via `readTextFile`, and selected-file row collapse.

## Props

| Prop         | Type                                              | Description                          |
| ------------ | ------------------------------------------------- | ------------------------------------ |
| `onFileText` | `(text: string, fileName: string) => void \| Promise<void>` | Called after successful read |
| `error`      | `string \| null`                                  | External error (e.g. import resolver) |
| `disabled`   | `boolean`                                         | Disables browse/drop while importing |

## Usage

Home **Open project** panel and Summary **Import (replace active project)** panel.

## Related

- [FileDropzone](../v2/FileDropzone.md)
- [native-yaml](../../../docs/features/import-export/native-yaml/README.md)
- Legacy `YamlFileDropzone.tsx` remains until v1 retire ([#927](https://github.com/pskillen/codeplug-studio/issues/927))
