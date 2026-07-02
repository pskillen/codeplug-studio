# FormatCatalogPanel

## Purpose

Renders one row in the CPS **format catalog** on `/import-export`: format label, import/export availability badges, and a placeholder when import is not yet shipped.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `entry` | `FormatCatalogEntry` | Registry row from `formatCatalog` |
| `highlighted` | `boolean` (optional) | Scroll into view and outline when `?format=` matches |

## Usage

```tsx
import { formatCatalog } from '@core/import-export/registry.ts';
import FormatCatalogPanel from './FormatCatalogPanel.tsx';

const opengd77 = formatCatalog.find((f) => f.id === 'opengd77')!;
<FormatCatalogPanel entry={opengd77} highlighted />;
```

## Behaviour

- **Shipped import** — reserved area for future dropzone (not wired in Phase 4a).
- **Planned import** — gray Mantine `Alert` with “coming soon” copy.
- Badges reflect `importStatus` / `exportStatus` from the registry (all CPS formats remain `planned` in 4a).

## Related

- [import-export feature hub](../../../docs/features/import-export/README.md)
- `CpsFormatCatalogGrid.tsx` — grid wrapper excluding native YAML
