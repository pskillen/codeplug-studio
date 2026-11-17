import { describe, expect, it, vi } from 'vitest';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import { recordExportDestination } from '@core/services/interchangeMeta.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';

vi.mock('../state/persistence.ts', async () => {
  const { InMemoryProjectPersistence } = await import('@integrations/persistence/inMemory.ts');
  return { persistence: new InMemoryProjectPersistence() };
});

import { persistence } from '../state/persistence.ts';
import { buildDriveOutgoingReview } from './driveOutgoingReviewService.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const remoteYaml = `schemaVersion: 1
studioSchemaVersion: 14
project:
  id: ${PROJECT_ID}
  projectId: ${PROJECT_ID}
  name: Fixture project
  description: ""
  notes: ""
  author: test
  revision: 1
  createdAt: 2026-07-02T10:00:00.000Z
  updatedAt: 2026-07-02T10:00:00.000Z
library:
  channels: []
  zones: []
  talkGroups: []
  digitalContacts: []
  analogContacts: []
  rxGroupLists: []
  scanLists: []
formatBuilds: []
`;

function mockDrivePort(modifiedTime: string): GoogleDrivePort {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: () => true,
    getAccountLabel: () => 'user@example.com',
    getAppRootFolderId: () => 'app-root-id',
    listChildren: vi.fn(),
    createFolder: vi.fn(),
    readFile: vi.fn(async () => remoteYaml),
    writeFile: vi.fn(),
    writeBinaryFile: vi.fn(),
    getFileMetadata: vi.fn(async () => ({
      id: 'file-1',
      name: 'demo.yaml',
      mimeType: 'application/yaml',
      modifiedTime,
    })),
  };
}

describe('buildDriveOutgoingReview', () => {
  it('describes a local-only channel as added to Drive, and writes nothing', async () => {
    const meta = recordExportDestination(
      newProjectMeta('Fixture project', PROJECT_ID),
      'googleDrive',
      { fileName: 'demo.yaml', folderId: 'folder-1', fileId: 'file-1' },
    );
    const channel = { ...newChannel(meta.projectId, 'GB3DA'), id: 'ch-new' };
    await persistence.seedProject({ meta, channels: [channel] });
    const port = mockDrivePort('2026-07-09T09:00:00.000Z');

    const review = await buildDriveOutgoingReview({
      port,
      localProjectId: meta.projectId,
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(review.entityChanges).toEqual([
      expect.objectContaining({ kind: 'channels', id: 'ch-new', change: 'added' }),
    ]);
    expect(review.countSummary).toBe('+1 channel');
    expect(review.conflictKinds).toEqual([]);
    expect(port.writeFile).not.toHaveBeenCalled();
  });

  it('flags a Drive copy newer than the last sync', async () => {
    const meta = recordExportDestination(
      newProjectMeta('Fixture project', PROJECT_ID),
      'googleDrive',
      { fileName: 'demo.yaml', folderId: 'folder-1', fileId: 'file-1' },
    );
    await persistence.seedProject({ meta, channels: [] });

    const review = await buildDriveOutgoingReview({
      port: mockDrivePort('2026-07-09T12:00:00.000Z'),
      localProjectId: meta.projectId,
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(review.conflictKinds).toEqual(['remoteNewer']);
    expect(review.remoteModifiedAt).toBe('2026-07-09T12:00:00.000Z');
  });
});
