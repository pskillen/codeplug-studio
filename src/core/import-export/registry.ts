import { nativeYamlExportAdapter, nativeYamlImportAdapter } from './formats/native-yaml/adapter.ts';
import type { ExportAdapter } from './exportAdapter.ts';
import type { ImportAdapter } from './importAdapter.ts';
import type { FormatCatalogEntry, FormatId } from './types.ts';

export const formatCatalog: readonly FormatCatalogEntry[] = [
  {
    id: 'native-yaml',
    label: 'Native YAML',
    importStatus: 'shipped',
    exportStatus: 'shipped',
  },
  {
    id: 'opengd77',
    label: 'OpenGD77 CSV',
    importStatus: 'planned',
    exportStatus: 'planned',
  },
  {
    id: 'chirp',
    label: 'CHIRP CSV',
    importStatus: 'planned',
    exportStatus: 'planned',
  },
  {
    id: 'dm32',
    label: 'DM32 CSV',
    importStatus: 'planned',
    exportStatus: 'planned',
  },
  {
    id: 'qdmr',
    label: 'qDMR YAML',
    importStatus: 'planned',
    exportStatus: 'planned',
  },
];

export const importAdapters: readonly ImportAdapter[] = [nativeYamlImportAdapter];

export const exportAdapters: readonly ExportAdapter[] = [nativeYamlExportAdapter];

export function getImportAdapter(id: FormatId): ImportAdapter {
  const adapter = importAdapters.find((a) => a.id === id);
  if (!adapter) {
    throw new Error(`No import adapter registered for format: ${id} (status: planned)`);
  }
  return adapter;
}

export function getExportAdapter(id: FormatId): ExportAdapter {
  const adapter = exportAdapters.find((a) => a.id === id);
  if (!adapter) {
    throw new Error(`No export adapter registered for format: ${id} (status: planned)`);
  }
  return adapter;
}

export function formatCatalogEntry(id: FormatId): FormatCatalogEntry | undefined {
  return formatCatalog.find((f) => f.id === id);
}
