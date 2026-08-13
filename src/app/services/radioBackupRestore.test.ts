import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import { createRadioSession } from '@integrations/radio-io/kit/session.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  parseRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { UV5R_MINI_LAYOUT } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import type { BytePipe, CloneImageRadio, RadioDescriptor } from '@integrations/radio-io/types.ts';
import {
  RadioRestoreError,
  assertRestoreAddressMap,
  descriptorSupportsRestore,
  downloadRadioBackupZip,
  filterRestoreRegionIds,
  openRadioBackupZip,
  packLiveRadioBackup,
  restoreRadioBackup,
} from './radioBackupRestore.ts';

describe('packLiveRadioBackup', () => {
  it('packs a UV-5R image and round-trips through parse', () => {
    const image = createMemoryMap(UV5R_MINI_LAYOUT.memTotal);
    image.fill(0, 16, 0x5a);
    const { manifest, zipBytes } = packLiveRadioBackup({
      descriptor: UV5R_MINI_DESCRIPTOR,
      image,
      capturedAt: '2026-08-13T12:00:00.000Z',
    });
    expect(manifest.capturedVia).toBe('web-serial');
    expect(manifest.regions.length).toBe(3);
    const parsed = parseRadioBackupZip(zipBytes);
    expect(parsed.manifest.radioModelId).toBe(manifest.radioModelId);
    expect(parsed.regions['mem-0']!.slice(0, 16)).toEqual(image.get(0, 16));
  });
});

describe('openRadioBackupZip', () => {
  it('rejects Radio Info debug zips that lack a backup manifest', () => {
    const zip = zipSync({
      'hydration.json': strToU8('{"formatId":"radio-clone"}'),
    });
    expect(() => openRadioBackupZip(zip)).toThrow(/manifest/i);
  });
});

describe('downloadRadioBackupZip', () => {
  it('names the file radio-backup-<model>-<stamp>.zip', () => {
    const image = createMemoryMap(UV5R_MINI_LAYOUT.memTotal);
    const { manifest, zipBytes } = packLiveRadioBackup({
      descriptor: UV5R_MINI_DESCRIPTOR,
      image,
      capturedAt: '2026-08-13T12:00:00.000Z',
    });
    const anchor = document.createElement('a');
    const click = vi.fn();
    anchor.click = click;
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    downloadRadioBackupZip(zipBytes, manifest);
    expect(anchor.download).toMatch(/^radio-backup-UV5R-Mini-.+\.zip$/);
    expect(click).toHaveBeenCalledOnce();
  });
});

const pipe: BytePipe = {
  write: async () => {},
  readExact: async () => new Uint8Array(),
  close: async () => {},
};

function restoreManifest(overrides?: Partial<RadioBackupManifestV1>): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-08-13T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'UV5R-Mini',
    descriptorLabel: 'Baofeng UV-5R Mini',
    coverage: 'full-clone',
    imageByteLength: 16,
    regions: [
      {
        id: 'channels',
        label: 'Channels',
        address: 0,
        byteLength: 8,
        path: 'regions/channels.bin',
        restoreRole: 'restorable',
      },
      {
        id: 'local-info',
        label: 'Local info',
        address: 8,
        byteLength: 8,
        path: 'regions/local-info.bin',
        restoreRole: 'inspect-only',
      },
    ],
    ...overrides,
  };
}

function fakeRadio(restoreFromBackup?: CloneImageRadio['restoreFromBackup']): CloneImageRadio {
  return {
    connect: async () => ({ raw: new Uint8Array() }),
    disconnect: async () => {},
    download: async () => createMemoryMap(16),
    upload: async () => {},
    decodeChannels: () => [],
    encodeChannels: (image) => image,
    readFirmware: () => 'fw-1',
    restoreFromBackup,
  };
}

function sessionFor(radio: CloneImageRadio, descriptor: RadioDescriptor = UV5R_MINI_DESCRIPTOR) {
  return createRadioSession({ descriptor, pipe, radio });
}

describe('restoreRadioBackup', () => {
  it('refuses a serial mismatch before calling restoreFromBackup', async () => {
    const restoreFromBackup = vi.fn();
    const radio = fakeRadio(restoreFromBackup);
    const session = sessionFor(radio);
    const manifest = restoreManifest({ serial: 'SN-ARCHIVE' });
    const image = createMemoryMap(16);

    await expect(restoreRadioBackup(session, { manifest, image })).rejects.toMatchObject({
      name: 'RadioRestoreError',
      code: 'serial-mismatch',
    });
    expect(restoreFromBackup).not.toHaveBeenCalled();
  });

  it('refuses a model mismatch before calling restoreFromBackup', async () => {
    const restoreFromBackup = vi.fn();
    const session = sessionFor(fakeRadio(restoreFromBackup));
    const manifest = restoreManifest({ radioModelId: 'AT-D890UV' });
    await expect(
      restoreRadioBackup(session, { manifest, image: createMemoryMap(16) }),
    ).rejects.toMatchObject({ code: 'model-mismatch' } as Partial<RadioRestoreError>);
    expect(restoreFromBackup).not.toHaveBeenCalled();
  });

  it('drops inspect-only region ids even when the caller includes them', async () => {
    const restoreFromBackup = vi.fn(async () => {});
    const session = sessionFor(fakeRadio(restoreFromBackup));
    const manifest = restoreManifest();
    await restoreRadioBackup(
      session,
      { manifest, image: createMemoryMap(16) },
      { regionIds: ['channels', 'local-info', 'bogus'] },
    );
    expect(restoreFromBackup).toHaveBeenCalledOnce();
    expect(restoreFromBackup).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ regionIds: ['channels'] }),
    );
  });

  it('throws when the protocol hook is missing', async () => {
    const session = sessionFor(fakeRadio());
    await expect(
      restoreRadioBackup(session, { manifest: restoreManifest(), image: createMemoryMap(16) }),
    ).rejects.toMatchObject({ code: 'no-restore-hook' });
  });

  it('does not enable restore on shipped adapters without the hook', () => {
    expect(descriptorSupportsRestore(UV5R_MINI_DESCRIPTOR)).toBe(false);
  });
});

describe('filterRestoreRegionIds', () => {
  it('defaults to all restorable ids and never includes inspect-only', () => {
    const manifest = restoreManifest();
    expect(filterRestoreRegionIds(manifest)).toEqual(['channels']);
    expect(filterRestoreRegionIds(manifest, ['local-info'])).toEqual([]);
  });
});

describe('assertRestoreAddressMap', () => {
  it('refuses when fragile bases are present and differ', () => {
    const manifest = restoreManifest({
      restoreFragileAfterFactoryReset: true,
      addressBase: 0x1000,
      dm32ContactsBase: 0x2000,
    });
    expect(() =>
      assertRestoreAddressMap(manifest, { addressBase: 0x9999, dm32ContactsBase: 0x2000 }),
    ).toThrow(/address-map-mismatch|addressBase/i);
  });

  it('does not compare when live discovery is omitted', () => {
    const manifest = restoreManifest({
      restoreFragileAfterFactoryReset: true,
      addressBase: 0x1000,
    });
    expect(() => assertRestoreAddressMap(manifest)).not.toThrow();
  });
});
