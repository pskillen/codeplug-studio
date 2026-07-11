import { describe, expect, it, vi } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import { recordExportDestination } from '@core/services/interchangeMeta.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';

vi.mock('../state/persistence.ts', async () => {
  const { InMemoryProjectPersistence } = await import('@integrations/persistence/inMemory.ts');
  return { persistence: new InMemoryProjectPersistence() };
});

import { persistence } from '../state/persistence.ts';
import { assessDriveSaveConflict } from './driveSaveConflictService.ts';

const FIXTURE_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const fixtureYaml = `schemaVersion: 1
studioSchemaVersion: 14
project:
  id: ${FIXTURE_PROJECT_ID}
  projectId: ${FIXTURE_PROJECT_ID}
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

function mockDrivePort(remoteYaml: string, modifiedTime: string): GoogleDrivePort {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: () => true,
    getAccountLabel: () => 'user@example.com',
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

describe('assessDriveSaveConflict', () => {
  it('returns null when remote is older and project ids match', async () => {
    const meta = recordExportDestination(newProjectMeta('Fixture project', FIXTURE_PROJECT_ID), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: [] });

    const result = await assessDriveSaveConflict({
      port: mockDrivePort(fixtureYaml, '2026-07-09T09:00:00.000Z'),
      localProjectId: meta.projectId,
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(result.conflict).toBeNull();
  });

  it('returns remoteNewer conflict when Drive modifiedTime is after local sync', async () => {
    const meta = recordExportDestination(newProjectMeta('Fixture project', FIXTURE_PROJECT_ID), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: [] });

    const result = await assessDriveSaveConflict({
      port: mockDrivePort(fixtureYaml, '2026-07-09T12:00:00.000Z'),
      localProjectId: meta.projectId,
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(result.conflict?.kinds).toEqual(['remoteNewer']);
    expect(result.conflict?.diffLines.length).toBeGreaterThan(0);
  });

  it('returns projectIdMismatch when remote yaml project id differs', async () => {
    const meta = recordExportDestination(newProjectMeta('Fixture project', FIXTURE_PROJECT_ID), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: [] });

    const result = await assessDriveSaveConflict({
      port: mockDrivePort(fixtureYaml, '2026-07-09T09:00:00.000Z'),
      localProjectId: '22222222-2222-4222-8222-222222222222',
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(result.conflict?.kinds).toEqual(['projectIdMismatch']);
  });
});
