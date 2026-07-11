import { describe, expect, it, vi } from 'vitest';
import { recordExportDestination } from '@core/services/interchangeMeta.ts';
import { serialiseProject } from '@core/import-export/formats/native-yaml/serialise.ts';
import {
  fixtureProjectMeta,
  fullLibraryAggregate,
} from '@core/import-export/formats/native-yaml/testFixtures.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';

vi.mock('../state/persistence.ts', async () => {
  const { InMemoryProjectPersistence } = await import('@integrations/persistence/inMemory.ts');
  return { persistence: new InMemoryProjectPersistence() };
});

import { persistence } from '../state/persistence.ts';
import { assessDriveSaveConflict } from './driveSaveConflictService.ts';

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
    const aggregate = fullLibraryAggregate();
    const yaml = serialiseProject(aggregate);
    const meta = recordExportDestination(fixtureProjectMeta(), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: aggregate.channels });

    const result = await assessDriveSaveConflict({
      port: mockDrivePort(yaml, '2026-07-09T09:00:00.000Z'),
      localProjectId: meta.projectId,
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(result.conflict).toBeNull();
  });

  it('returns remoteNewer conflict when Drive modifiedTime is after local sync', async () => {
    const aggregate = fullLibraryAggregate();
    const yaml = serialiseProject(aggregate);
    const meta = recordExportDestination(fixtureProjectMeta(), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: aggregate.channels });

    const result = await assessDriveSaveConflict({
      port: mockDrivePort(yaml, '2026-07-09T12:00:00.000Z'),
      localProjectId: meta.projectId,
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(result.conflict?.kinds).toEqual(['remoteNewer']);
    expect(result.conflict?.diffLines.length).toBeGreaterThan(0);
  });

  it('returns projectIdMismatch when remote yaml project id differs', async () => {
    const aggregate = fullLibraryAggregate();
    const yaml = serialiseProject(aggregate);
    const meta = recordExportDestination(fixtureProjectMeta(), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: aggregate.channels });

    const result = await assessDriveSaveConflict({
      port: mockDrivePort(yaml, '2026-07-09T09:00:00.000Z'),
      localProjectId: '22222222-2222-4222-8222-222222222222',
      localSyncedAt: '2026-07-09T10:00:00.000Z',
      drive: { fileId: 'file-1' },
    });

    expect(result.conflict?.kinds).toEqual(['projectIdMismatch']);
  });
});
