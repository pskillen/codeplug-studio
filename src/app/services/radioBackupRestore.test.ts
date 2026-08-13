import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import { UV5R_MINI_LAYOUT } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { parseRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import {
  downloadRadioBackupZip,
  openRadioBackupZip,
  packLiveRadioBackup,
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
