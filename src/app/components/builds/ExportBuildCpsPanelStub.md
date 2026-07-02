# ExportBuildCpsPanelStub

## Purpose

Placeholder for **per-build CPS export** on the radio build detail page (`/builds/:id`). Replaces the import/export page build selector — export is scoped to the build the operator is editing.

## Props

| Prop    | Type          | Description      |
| ------- | ------------- | ---------------- |
| `build` | `FormatBuild` | Active build row |

## Usage

```tsx
import ExportBuildCpsPanelStub from '../../components/builds/ExportBuildCpsPanelStub.tsx';

<ExportBuildCpsPanelStub build={build} />;
```

## Behaviour

- Shows target format label, saved profile, and wire-limit hint (read-only).
- Disabled **Export CPS (coming soon)** button until the format export adapter ships.
- Full download/ZIP/warnings wiring follows in Phase 4 export slices.

## Related

- [builds feature hub](../../../docs/features/builds/README.md)
- [import-export hub](../../../docs/features/import-export/README.md) — CPS import catalog + pointer to Radio builds
