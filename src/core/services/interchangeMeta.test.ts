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

  it('recordExportDestination stores google drive memory', () => {
    const meta = newProjectMeta('Demo');
    const updated = recordExportDestination(meta, 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      folderName: 'Codeplugs',
      fileId: 'file-1',
    });
    expect(updated.interchange?.googleDrive).toEqual({
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      folderName: 'Codeplugs',
      fileId: 'file-1',
      exportedAt: expect.any(String),
    });
    expect(suggestExportDestination(updated, 'googleDrive')).toEqual({ fileName: 'demo.yaml' });
  });

  it('interchange round-trips localFile through native YAML serialise/parse', () => {
    const aggregate = minimalProjectAggregate();
    aggregate.meta = recordExportDestination(aggregate.meta, 'localFile', {
      fileName: 'fixture.yaml',
    });
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    expect(parsed.meta.interchange?.localFile?.fileName).toBe('fixture.yaml');
  });

  it('interchange round-trips googleDrive through native YAML serialise/parse', () => {
    const aggregate = minimalProjectAggregate();
    aggregate.meta = recordExportDestination(aggregate.meta, 'googleDrive', {
      fileName: 'drive.yaml',
      folderId: 'folder-abc',
      folderName: 'Exports',
      fileId: 'file-xyz',
    });
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    expect(parsed.meta.interchange?.googleDrive?.fileName).toBe('drive.yaml');
    expect(parsed.meta.interchange?.googleDrive?.folderId).toBe('folder-abc');
    expect(parsed.meta.interchange?.googleDrive?.fileId).toBe('file-xyz');
  });
});
