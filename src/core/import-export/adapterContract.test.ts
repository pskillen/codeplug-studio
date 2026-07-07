import { describe, expect, it } from 'vitest';
import { isMultiFileExportAdapter, isSingleFileProjectExportAdapter } from './exportAdapter.ts';
import { isSingleFileProjectImportAdapter } from './importAdapter.ts';
import { nativeYamlExportAdapter, nativeYamlImportAdapter } from './formats/native-yaml/adapter.ts';
import { formatCatalog, getExportAdapter, getImportAdapter } from './registry.ts';

describe('adapter contracts', () => {
  it('native-yaml import adapter has required metadata', () => {
    expect(nativeYamlImportAdapter.id).toBe('native-yaml');
    expect(nativeYamlImportAdapter.status).toBe('shipped');
    expect(nativeYamlImportAdapter.capabilities.delivery).toBe('single-file');
    expect(isSingleFileProjectImportAdapter(nativeYamlImportAdapter)).toBe(true);
    expect(typeof nativeYamlImportAdapter.parseDocument).toBe('function');
  });

  it('native-yaml export adapter is single-file', () => {
    expect(nativeYamlExportAdapter.id).toBe('native-yaml');
    expect(nativeYamlExportAdapter.status).toBe('shipped');
    expect(isSingleFileProjectExportAdapter(nativeYamlExportAdapter)).toBe(true);
    expect(nativeYamlExportAdapter.defaultFileName).toBe('project.yaml');
    expect(typeof nativeYamlExportAdapter.serialise).toBe('function');
  });

  it('registry resolves shipped native-yaml adapters', () => {
    expect(getImportAdapter('native-yaml').id).toBe('native-yaml');
    expect(getExportAdapter('native-yaml').id).toBe('native-yaml');
  });

  it('registry resolves shipped opengd77 export adapter', () => {
    const adapter = getExportAdapter('opengd77');
    expect(adapter.id).toBe('opengd77');
    expect(adapter.defaultExportSettings?.defaultScanInclusion).toBe('scan');
    expect(adapter.delivery).toBe('multi-file');
  });

  it('registry resolves shipped dm32 export adapter', () => {
    const adapter = getExportAdapter('dm32');
    expect(adapter.id).toBe('dm32');
    expect(adapter.defaultExportSettings?.defaultScanInclusion).toBe('scan');
    expect(isMultiFileExportAdapter(adapter)).toBe(true);
    if (isMultiFileExportAdapter(adapter)) {
      expect(adapter.delivery).toBe('multi-file');
      expect(adapter.fileNames).toContain('Channels.csv');
      expect(adapter.fileNames).toContain('Scan.csv');
    }
  });

  it('registry throws for planned CPS import adapters', () => {
    expect(() => getImportAdapter('opengd77')).toThrow(/No import adapter/);
    expect(() => getExportAdapter('chirp')).toThrow(/No export adapter/);
  });

  it('format catalog lists native-yaml and opengd77 export as shipped', () => {
    const nativeYaml = formatCatalog.find((f) => f.id === 'native-yaml');
    expect(nativeYaml?.importStatus).toBe('shipped');
    expect(nativeYaml?.exportStatus).toBe('shipped');

    const opengd77 = formatCatalog.find((f) => f.id === 'opengd77');
    expect(opengd77?.importStatus).toBe('planned');
    expect(opengd77?.exportStatus).toBe('shipped');

    const dm32 = formatCatalog.find((f) => f.id === 'dm32');
    expect(dm32?.exportStatus).toBe('shipped');
    expect(dm32?.importStatus).toBe('planned');
  });
});
