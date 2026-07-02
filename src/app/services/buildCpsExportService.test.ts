import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { newProjectMeta } from '@core/domain/factories.ts';
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

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../core/import-export/formats/native-yaml/__fixtures__/export',
);

describe('buildCpsExportService', () => {
  async function seedFixtureStore() {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const meta = newProjectMeta('Export test');
    meta.projectId = aggregate.formatBuilds[0]!.projectId;
    const store = new InMemoryProjectPersistence();
    await store.seedProject({
      meta,
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
      formatBuilds: aggregate.formatBuilds,
    });
    return { store, build: aggregate.formatBuilds[0]!, projectId: meta.projectId };
  }

  it('defaultCpsZipFileName slugifies build name and format id', () => {
    expect(defaultCpsZipFileName('OpenGD77 1701', 'opengd77')).toBe('OpenGD77-1701-opengd77.zip');
  });

  it('buildCpsZipBytes returns a non-empty zip with expected filename', async () => {
    const { store, build, projectId } = await seedFixtureStore();
    const result = await buildCpsZipBytes(projectId, build.id, undefined, store);
    expect(result.fileName).toBe('OpenGD77-1701-opengd77.zip');
    expect(result.zip.byteLength).toBeGreaterThan(0);
    expect(result.zip[0]).toBe(0x50);
    expect(result.warnings).toEqual([]);
  });

  it('uploadCpsZipToDrive writes binary zip to Google Drive', async () => {
    writeBinaryFile.mockClear();
    const { store, build, projectId } = await seedFixtureStore();
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
