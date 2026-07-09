import { describe, expect, it } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import {
  fullLibraryAggregate,
  minimalProjectAggregate,
} from '@core/import-export/formats/native-yaml/testFixtures.ts';
import {
  formatSyncDiffSummary,
  hasPortableInterchange,
  portableInterchangeLabel,
  summariseProjectAggregate,
} from './projectSyncSummary.ts';
import { recordImportDestination } from './interchangeMeta.ts';

describe('projectSyncSummary', () => {
  it('summarises entity counts from aggregate', () => {
    const aggregate = fullLibraryAggregate();
    const summary = summariseProjectAggregate(aggregate);
    expect(summary.counts.channels).toBeGreaterThan(0);
    expect(summary.projectId).toBe(aggregate.meta.projectId);
  });

  it('formatSyncDiffSummary compares local and remote', () => {
    const aggregate = minimalProjectAggregate();
    const local = summariseProjectAggregate(aggregate);
    const remote = summariseProjectAggregate({
      ...aggregate,
      meta: recordImportDestination(aggregate.meta, 'googleDrive', {
        fileName: 'remote.yaml',
        folderId: 'folder-1',
        fileId: 'file-1',
      }),
      channels: [...aggregate.channels, { ...aggregate.channels[0]!, id: 'ch-2', name: 'Two' }],
    });
    const lines = formatSyncDiffSummary(local, remote);
    expect(lines.some((line) => line.startsWith('Local last edited:'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Remote last saved:'))).toBe(true);
  });

  it('portableInterchangeLabel prefers google drive', () => {
    const meta = recordImportDestination(newProjectMeta('Demo'), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'f1',
      fileId: 'file-1',
    });
    expect(portableInterchangeLabel(meta)).toBe('Google Drive · demo.yaml');
    expect(hasPortableInterchange(meta)).toBe(true);
  });
});
