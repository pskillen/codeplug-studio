import { describe, expect, it, vi } from 'vitest';
import {
  newChannel,
  newFormatBuild,
  newProjectMeta,
} from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import {
  buildCpsZipBytes,
  defaultCpsZipFileName,
  uploadCpsZipToDrive,
} from './buildCpsExportService.ts';

const { writeBinaryFile } = vi.hoisted(() => ({
  writeBinaryFile: vi.fn(async () => ({
    id: 'zip-file',
    name: 'demo-opengd77.zip',
    mimeType: 'application/zip',
  })),
}));

vi.mock('@integrations/cloud/index.ts', () => ({
  googleDrivePort: {
    writeBinaryFile,
  },
}));

describe('buildCpsExportService', () => {
  async function seedStore() {
    const meta = newProjectMeta('Export test');
    const channel = newChannel(meta.projectId, 'GB3DA Demo', 'GB3DA');
    const build = newFormatBuild(meta.projectId, 'opengd77-1701', 'OpenGD77 1701');
    const store = new InMemoryProjectPersistence();
    await store.seedProject({
      meta,
      channels: [channel],
      formatBuilds: [build],
    });
    return { store, build, projectId: meta.projectId };
  }

  it('defaultCpsZipFileName slugifies build name and format id', () => {
    expect(defaultCpsZipFileName('OpenGD77 1701', 'opengd77')).toBe('OpenGD77-1701-opengd77.zip');
  });

  it('buildCpsZipBytes returns a non-empty zip with expected filename', async () => {
    const { store, build, projectId } = await seedStore();
    const result = await buildCpsZipBytes(projectId, build.id, undefined, store);
    expect(result.fileName).toBe('OpenGD77-1701-opengd77.zip');
    expect(result.zip.byteLength).toBeGreaterThan(0);
    expect(result.zip[0]).toBe(0x50);
    expect(result.warnings).toEqual([]);
  });

  it('uploadCpsZipToDrive writes binary zip to Google Drive', async () => {
    writeBinaryFile.mockClear();
    const { store, build, projectId } = await seedStore();
    const result = await uploadCpsZipToDrive(
      projectId,
      build.id,
      { folderId: 'folder-1', fileName: 'demo-opengd77.zip' },
      undefined,
      store,
    );
    expect(writeBinaryFile).toHaveBeenCalledOnce();
    expect(writeBinaryFile).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 'folder-1',
        fileName: 'demo-opengd77.zip',
        mimeType: 'application/zip',
        content: expect.any(Uint8Array),
      }),
    );
    expect(result.warnings).toEqual([]);
  });
});
