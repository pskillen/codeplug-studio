## Purpose

Build export panel section for choosing `FormatBuild.activeAprsConfigurationId` on Anytone D890 builds.

## Props

| Prop                   | Type                                 | Description                                |
| ---------------------- | ------------------------------------ | ------------------------------------------ |
| `build`                | `FormatBuild`                        | Current build (reads active config id)     |
| `aprsConfigurations`   | `AprsConfiguration[]`                | Library configs for the select options     |
| `saving`               | `boolean`                            | Disables the select while persisting       |
| `onActiveConfigChange` | `(configId: string \| null) => void` | Called when the operator changes selection |

## Usage

```tsx
<BuildAprsSettingsSection
  build={build}
  aprsConfigurations={aprsConfigurations}
  saving={savingSettings}
  onActiveConfigChange={(id) => void handleActiveAprsChange(id)}
/>
```

## Behaviour

- Renders only when `build.profileId === 'anytone-at-d890uv'`.
- `null` / “None selected” clears `activeAprsConfigurationId`.
- Warns when library has configs but the build has none selected (matches `assemble` warnings).

## Related

- [APRS feature hub](../../../../docs/features/aprs/README.md)
- `ExportBuildCpsPanel` — parent export settings surface
