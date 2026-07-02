import { describe, expect, it } from 'vitest';
import { isSingleFileProjectExportAdapter } from './exportAdapter.ts';
import { isSingleFileProjectImportAdapter } from './importAdapter.ts';
import {
  nativeYamlExportAdapter,
  nativeYamlImportAdapter,
} from './formats/native-yaml/adapter.ts';
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

  it('registry throws for planned CPS formats', () => {
    expect(() => getImportAdapter('opengd77')).toThrow(/No import adapter/);
    expect(() => getExportAdapter('chirp')).toThrow(/No export adapter/);
  });

  it('format catalog lists native-yaml as shipped and CPS as planned', () => {
    const nativeYaml = formatCatalog.find((f) => f.id === 'native-yaml');
    expect(nativeYaml?.importStatus).toBe('shipped');
    expect(nativeYaml?.exportStatus).toBe('shipped');

    const opengd77 = formatCatalog.find((f) => f.id === 'opengd77');
    expect(opengd77?.importStatus).toBe('planned');
    expect(opengd77?.exportStatus).toBe('planned');
  });
});
