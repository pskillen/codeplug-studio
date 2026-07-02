import { describe, expect, it } from 'vitest';
import { getExportAdapter, getImportAdapter } from '../../registry.ts';
import { parseProjectDocument } from './parse.ts';
import { serialiseProject } from './serialise.ts';
import { projectWithFormatBuildAggregate } from './testFixtures.ts';

describe('native-yaml round-trip smoke', () => {
  it('serialise → parse preserves aggregate via adapters', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const exportAdapter = getExportAdapter('native-yaml');
    const importAdapter = getImportAdapter('native-yaml');

    const { content } = exportAdapter.serialise(aggregate);
    const { project } = importAdapter.parseDocument(content);

    expect(project).toEqual(aggregate);
  });

  it('serialise → parse via module functions', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const yaml = serialiseProject(aggregate);
    expect(parseProjectDocument(yaml)).toEqual(aggregate);
  });
});
