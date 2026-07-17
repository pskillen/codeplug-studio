# Dm32AprsSetupAlert

On-screen instructions when a DM32 export includes `APRS.md` (library APRS configuration present).

## Purpose

Baofeng DM-32UV CPS v1.60 has no `APRS.csv`. Operators must set global APRS fields in CPS after importing Studio’s CSV bundle. This alert points them at the checklist and the `APRS.md` guide in the ZIP.

## Props

| Prop             | Type                 | Description                                      |
| ---------------- | -------------------- | ------------------------------------------------ |
| `exportFileNames` | `readonly string[]` | Resolved export file list for the current build |

## Usage

```tsx
<Dm32AprsSetupAlert exportFileNames={exportFileNames} />
```

## Behaviour

- Renders nothing unless `APRS.md` is in `exportFileNames`.
- Does not load library state itself — file list already reflects assemble + `resolveExportFileNames`.

## Related

- [APRS feature hub](../../../../docs/features/aprs/README.md)
- [`ExportBuildCpsPanel.tsx`](ExportBuildCpsPanel.tsx)
- Core guide: `src/core/import-export/formats/dm32/aprsGuide.ts`
