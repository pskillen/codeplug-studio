import { SimpleGrid } from '@mantine/core';
import { formatCatalog } from '@core/import-export/registry.ts';
import type { FormatId } from '@core/import-export/types.ts';
import FormatCatalogPanel from './FormatCatalogPanel.tsx';

const CPS_FORMATS = formatCatalog.filter((f) => f.id !== 'native-yaml');

export interface CpsFormatCatalogGridProps {
  highlightedFormatId?: FormatId | null;
}

export default function CpsFormatCatalogGrid({ highlightedFormatId }: CpsFormatCatalogGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {CPS_FORMATS.map((entry) => (
        <FormatCatalogPanel
          key={entry.id}
          entry={entry}
          highlighted={highlightedFormatId === entry.id}
        />
      ))}
    </SimpleGrid>
  );
}
