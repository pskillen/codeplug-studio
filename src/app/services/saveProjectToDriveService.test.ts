import { describe, expect, it, vi } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import { recordExportDestination } from '@core/services/interchangeMeta.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';

vi.mock('../state/persistence.ts', async () => {
  const { InMemoryProjectPersistence } = await import('@integrations/persistence/inMemory.ts');
  return { persistence: new InMemoryProjectPersistence() };
});

import { persistence } from '../state/persistence.ts';
import {
  recordDrivePortableSyncAfterWrite,
  saveProjectToDrive,
} from './saveProjectToDriveService.ts';

function mockDrivePort(overrides: Partial<GoogleDrivePort> = {}): GoogleDrivePort {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: () => true,
    getAccountLabel: () => 'user@example.com',
    listChildren: vi.fn(),
    createFolder: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(async () => ({
      id: 'file-1',
      name: 'demo.yaml',
      mimeType: 'application/yaml',
      modifiedTime: '2026-07-09T14:04:50.000Z',
    })),
    writeBinaryFile: vi.fn(),
    getFileMetadata: vi.fn(async () => ({
      id: 'file-1',
      name: 'demo.yaml',
      mimeType: 'application/yaml',
      modifiedTime: '2026-07-09T14:04:50.000Z',
    })),
    ...overrides,
  };
}

describe('saveProjectToDriveService', () => {
  it('records Drive modifiedTime after overwrite save', async () => {
    const meta = recordExportDestination(newProjectMeta('Demo'), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: [] });

    const port = mockDrivePort();
    await saveProjectToDrive(port, {
      projectId: meta.projectId,
      drive: meta.interchange!.googleDrive!,
    });

    const updated = await persistence.loadProjectMeta(meta.projectId);
    expect(updated?.interchange?.googleDrive?.exportedAt).toBe('2026-07-09T14:04:50.000Z');
  });

  it('falls back to metadata when write response lacks modifiedTime', async () => {
    const meta = recordExportDestination(newProjectMeta('Demo'), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: [] });

    const port = mockDrivePort({
      writeFile: vi.fn(async () => ({
        id: 'file-1',
        name: 'demo.yaml',
        mimeType: 'application/yaml',
      })),
      getFileMetadata: vi.fn(async () => ({
        id: 'file-1',
        name: 'demo.yaml',
        mimeType: 'application/yaml',
        modifiedTime: '2026-07-09T14:05:00.000Z',
      })),
    });

    const syncedAt = await recordDrivePortableSyncAfterWrite(
      port,
      meta.projectId,
      meta.interchange!.googleDrive!,
      {},
    );

    expect(syncedAt).toBe('2026-07-09T14:05:00.000Z');
  });
});
