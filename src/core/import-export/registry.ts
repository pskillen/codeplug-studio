import { nativeYamlExportAdapter, nativeYamlImportAdapter } from './formats/native-yaml/adapter.ts';
import { opengd77ExportAdapter } from './formats/opengd77/adapter.ts';
import { dm32ExportAdapter } from './formats/dm32/adapter.ts';
import type { ExportAdapter } from './exportAdapter.ts';
import type { ImportAdapter } from './importAdapter.ts';
import type { FormatCatalogEntry, FormatExportDefaults, FormatId } from './types.ts';

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
    exportStatus: 'shipped',
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
    exportStatus: 'shipped',
  },
  {
    id: 'qdmr',
    label: 'qDMR YAML',
    importStatus: 'planned',
    exportStatus: 'planned',
  },
];

export const importAdapters: readonly ImportAdapter[] = [nativeYamlImportAdapter];

export const exportAdapters: readonly ExportAdapter[] = [
  nativeYamlExportAdapter,
  opengd77ExportAdapter,
  dm32ExportAdapter,
];

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

const CHIRP_EXPORT_DEFAULTS: FormatExportDefaults = {
  defaultScanInclusion: 'skip',
  expandModes: false,
  expandRxGroupLists: false,
};

const OPENGD77_EXPORT_DEFAULTS: FormatExportDefaults = {
  defaultScanInclusion: 'scan',
  expandModes: true,
  expandRxGroupLists: false,
};

const DM32_EXPORT_DEFAULTS: FormatExportDefaults = {
  defaultScanInclusion: 'scan',
  expandModes: false,
  expandRxGroupLists: true,
};

const FORMAT_EXPORT_DEFAULTS: Partial<Record<FormatId, FormatExportDefaults>> = {
  chirp: CHIRP_EXPORT_DEFAULTS,
  opengd77: OPENGD77_EXPORT_DEFAULTS,
  dm32: DM32_EXPORT_DEFAULTS,
};

export function getFormatExportDefaults(formatId: string): FormatExportDefaults {
  const fromAdapter = exportAdapters.find((a) => a.id === formatId)?.defaultExportSettings;
  if (fromAdapter) return fromAdapter;
  return FORMAT_EXPORT_DEFAULTS[formatId as FormatId] ?? { defaultScanInclusion: 'scan' };
}
