import { describe, expect, it } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import { serialiseProject } from '@core/import-export/formats/native-yaml/serialise.ts';
import { minimalProjectAggregate } from '@core/import-export/formats/native-yaml/testFixtures.ts';
import {
  defaultLocalExportFileName,
  recordExportDestination,
  suggestExportDestination,
} from './interchangeMeta.ts';

describe('interchangeMeta', () => {
  it('defaultLocalExportFileName sanitises project name', () => {
    expect(defaultLocalExportFileName('Home shack')).toBe('Home-shack.yaml');
    expect(defaultLocalExportFileName('  ')).toBe('project.yaml');
  });

  it('recordExportDestination stores local file memory', () => {
    const meta = newProjectMeta('Demo');
    const updated = recordExportDestination(meta, 'localFile', {
      fileName: 'demo-export.yaml',
    });
    expect(updated.interchange?.localFile?.fileName).toBe('demo-export.yaml');
    expect(updated.interchange?.localFile?.exportedAt).toBeTruthy();
  });

  it('suggestExportDestination returns last local filename', () => {
    const meta = recordExportDestination(newProjectMeta('Demo'), 'localFile', {
      fileName: 'last.yaml',
    });
    expect(suggestExportDestination(meta, 'localFile')).toEqual({ fileName: 'last.yaml' });
    expect(suggestExportDestination(newProjectMeta('Demo'), 'localFile')).toBeNull();
  });

  it('interchange round-trips through native YAML serialise/parse', () => {
    const aggregate = minimalProjectAggregate();
    aggregate.meta = recordExportDestination(aggregate.meta, 'localFile', {
      fileName: 'fixture.yaml',
    });
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    expect(parsed.meta.interchange?.localFile?.fileName).toBe('fixture.yaml');
  });
});
