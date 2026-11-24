import { describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';
import {
  newChannel,
  newOwnDigitalId,
  newProjectMeta,
  newRadioBuildForProfile,
} from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { DM32_CORE_EXPORT_FILES } from '../../test/dm32CsvCompare.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import {
  buildCpsZipBytes,
  checkCpsExport,
  defaultCpsZipFileName,
  downloadCpsSingleFile,
  downloadCpsZip,
  uploadCpsZipToDrive,
} from './buildCpsExportService.ts';

const { downloadZip, downloadTextFile, downloadBinaryFile } = vi.hoisted(() => ({
  downloadZip: vi.fn(),
  downloadTextFile: vi.fn(),
  downloadBinaryFile: vi.fn(),
}));

vi.mock('@integrations/download/browserDownload.ts', () => ({
  downloadZip,
  downloadTextFile,
  downloadBinaryFile,
}));

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
    const channel = withExportEligibleDefaults(newChannel(meta.projectId, 'GB3DA Demo', 'GB3DA'));
    const { build, egressPaths } = newRadioBuildForProfile(
      meta.projectId,
      'opengd77-1701',
      'OpenGD77 1701',
    );
    const store = new InMemoryProjectPersistence();
    await store.seedProject({
      meta,
      channels: [channel],
      radioBuilds: [build],
      egressPaths,
    });
    return { store, build, projectId: meta.projectId };
  }

  it('defaultCpsZipFileName slugifies build name and format id', () => {
    expect(defaultCpsZipFileName('OpenGD77 1701', 'opengd77')).toBe('OpenGD77-1701-opengd77.zip');
    expect(defaultCpsZipFileName('Neon DM32', 'neonplug')).toBe('Neon-DM32-neonplug.neonplug');
  });

  it('buildCpsZipBytes returns a non-empty zip with expected filename', async () => {
    const { store, build, projectId } = await seedStore();
    const result = await buildCpsZipBytes(projectId, build.id, undefined, store);
    expect(result.fileName).toBe('OpenGD77-1701-opengd77.zip');
    expect(result.zip.byteLength).toBeGreaterThan(0);
    expect(result.zip[0]).toBe(0x50);
    expect(result.warnings).toEqual([
      {
        kind: 'unlinked',
        severity: 'problem',
        message: 'Including 1 channel(s) not linked to a zone',
      },
    ]);
  });

  it('buildCpsZipBytes for NeonPlug uses .neonplug and packs codeplug.json', async () => {
    const meta = newProjectMeta('NeonPlug export test');
    const channel = {
      ...newChannel(meta.projectId, 'GB3AO'),
      rxFrequency: 145_600_000,
      txFrequency: 145_600_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          squelch: null,
          bandwidthKHz: 12.5,
        },
      ],
    };
    const { build, egressPaths } = newRadioBuildForProfile(
      meta.projectId,
      'neonplug-dm32uv',
      'Neon DM32',
    );
    const store = new InMemoryProjectPersistence();
    await store.seedProject({
      meta,
      channels: [channel],
      radioBuilds: [build],
      egressPaths,
    });
    const result = await buildCpsZipBytes(meta.projectId, build.id, undefined, store);
    expect(result.fileName).toBe('Neon-DM32-neonplug.neonplug');
    expect(result.zip[0]).toBe(0x50); // ZIP local file header 'P'
    const entries = unzipSync(result.zip);
    expect(Object.keys(entries)).toEqual(['codeplug.json']);
    const json = JSON.parse(new TextDecoder().decode(entries['codeplug.json']));
    expect(json.version).toBe('1.0.0');
    expect(json.channels).toHaveLength(1);
    expect(json.radioInfo.model).toBe('DP570UV');
  });

  it('buildCpsZipBytes for DM32 build contains core CSV files', async () => {
    const meta = newProjectMeta('DM32 export test');
    const channel = newChannel(meta.projectId, 'GB7FE Stirling');
    const { build, egressPaths } = newRadioBuildForProfile(
      meta.projectId,
      'dm32-baofeng-dm32uv',
      'DM32 UV',
    );
    const store = new InMemoryProjectPersistence();
    await store.seedProject({
      meta,
      channels: [channel],
      radioBuilds: [build],
      egressPaths,
    });
    const result = await buildCpsZipBytes(meta.projectId, build.id, undefined, store);
    expect(result.fileName).toBe('DM32-UV-dm32.zip');
    const entries = Object.keys(unzipSync(result.zip));
    for (const fileName of DM32_CORE_EXPORT_FILES) {
      expect(entries).toContain(fileName);
    }
  });

  it('checkCpsExport returns the same warnings the download does for multi-file', async () => {
    downloadZip.mockClear();
    const { store, build, projectId } = await seedStore();
    const check = await checkCpsExport(projectId, build.id, undefined, store);
    const download = await buildCpsZipBytes(projectId, build.id, undefined, store);
    await downloadCpsZip(projectId, build.id, undefined, store);
    expect(check.warnings).toEqual(download.warnings);
    expect(downloadZip).toHaveBeenCalledOnce();
    expect(check.warnings).toEqual([
      {
        kind: 'unlinked',
        severity: 'problem',
        message: 'Including 1 channel(s) not linked to a zone',
      },
    ]);
  });

  it('checkCpsExport returns the same warnings for CHIRP single file', async () => {
    downloadTextFile.mockClear();
    const meta = newProjectMeta('CHIRP export');
    const channel = withExportEligibleDefaults(newChannel(meta.projectId, 'CH', 'M7ABC'));
    const { build, egressPaths } = newRadioBuildForProfile(meta.projectId, 'chirp-uv5r', 'CHIRP');
    const store = new InMemoryProjectPersistence();
    await store.seedProject({ meta, channels: [channel], radioBuilds: [build], egressPaths });
    const check = await checkCpsExport(meta.projectId, build.id, undefined, store);
    await downloadCpsSingleFile(meta.projectId, build.id, undefined, store);
    expect(downloadTextFile).toHaveBeenCalledOnce();
    expect(check.fileNames.length).toBe(1);
  });

  it('checkCpsExport returns warnings for RadioFoundry binary without download', async () => {
    downloadBinaryFile.mockClear();
    const meta = newProjectMeta('RF export');
    const channel = withExportEligibleDefaults(newChannel(meta.projectId, 'CH', 'M7ABC'));
    const ownDigitalIds = [
      { ...newOwnDigitalId(meta.projectId, 'dmr', 'M7ABC', 235_103), isDefault: true },
    ];
    const { build, egressPaths } = newRadioBuildForProfile(
      meta.projectId,
      'radiofoundry-dm32uv',
      'RF build',
    );
    const store = new InMemoryProjectPersistence();
    await store.seedProject({
      meta,
      channels: [channel],
      ownDigitalIds,
      radioBuilds: [build],
      egressPaths,
    });
    const check = await checkCpsExport(meta.projectId, build.id, undefined, store);
    await downloadCpsZip(meta.projectId, build.id, undefined, store);
    expect(check.fileNames).toEqual(['codeplug.bin']);
    expect(downloadBinaryFile).toHaveBeenCalledOnce();
  });

  it('checkCpsExport never triggers a download', async () => {
    downloadZip.mockClear();
    downloadTextFile.mockClear();
    downloadBinaryFile.mockClear();
    const { store, build, projectId } = await seedStore();
    await checkCpsExport(projectId, build.id, undefined, store);
    expect(downloadZip).not.toHaveBeenCalled();
    expect(downloadTextFile).not.toHaveBeenCalled();
    expect(downloadBinaryFile).not.toHaveBeenCalled();
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
    expect(result.warnings).toEqual([
      {
        kind: 'unlinked',
        severity: 'problem',
        message: 'Including 1 channel(s) not linked to a zone',
      },
    ]);
  });
});
