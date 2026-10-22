import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareError } from '@core/firmware/errors.ts';
import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import * as prepareModule from '@core/services/firmware/prepareFirmwareImage.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import * as radioIo from '@integrations/radio-io';
import type { FirmwareUpdater } from '@integrations/radio-io';

import {
  formatFirmwareFlashSummary,
  listBundledReleases,
  loadChosenPatch,
  prepareFlash,
  type VerifiedStockFirmware,
} from './firmwareFlash.ts';

const checkImage = vi.fn();

vi.mock('@core/services/firmware/prepareFirmwareImage.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof prepareModule>();
  return { ...actual, prepareFirmwareImage: vi.fn() };
});

vi.mock('@integrations/radio-io', async (importOriginal) => {
  const actual = await importOriginal<typeof radioIo>();
  return {
    ...actual,
    getFirmwareUpdater: vi.fn((radioId: 'baofeng-dm32uv') => {
      const real = actual.getFirmwareUpdater(radioId);
      return (
        real && { ...real, createUpdater: () => ({ checkImage }) as unknown as FirmwareUpdater }
      );
    }),
  };
});

const STOCK = {} as VerifiedStockFirmware;
const IMAGE = { provenance: 'stock' } as unknown as PreparedFirmwareImage;
const LOADED = { provenance: 'bundled' } as unknown as LoadedFirmwarePatch;

describe('prepareFlash', () => {
  beforeEach(() => {
    vi.mocked(prepareModule.prepareFirmwareImage).mockReset().mockResolvedValue(IMAGE);
    checkImage.mockReset();
  });

  it('routes a stock choice to the stock target and runs the interlocks', async () => {
    await expect(prepareFlash('baofeng-dm32uv', STOCK, { kind: 'stock' })).resolves.toBe(IMAGE);
    expect(vi.mocked(prepareModule.prepareFirmwareImage).mock.calls[0]![0].target).toEqual({
      kind: 'stock',
    });
    expect(checkImage).toHaveBeenCalledWith(IMAGE);
  });

  it('routes a patch choice to the patch target', async () => {
    await prepareFlash(
      'baofeng-dm32uv',
      STOCK,
      { kind: 'user-patch', file: { name: 'p.json', bytes: new Uint8Array(1) } },
      LOADED,
    );
    expect(vi.mocked(prepareModule.prepareFirmwareImage).mock.calls[0]![0].target).toEqual({
      kind: 'patch',
      patch: LOADED,
    });
    expect(checkImage).toHaveBeenCalled();
  });

  it('does not build an image when the interlocks refuse it', async () => {
    checkImage.mockImplementation(() => {
      throw new radioIo.RadioInterlockError('no');
    });
    await expect(prepareFlash('baofeng-dm32uv', STOCK, { kind: 'stock' })).rejects.toBeInstanceOf(
      radioIo.RadioInterlockError,
    );
  });
});

describe('bundled releases and chosen patches', () => {
  it('lists the bundled DM-32UV 1.0.0 final', async () => {
    const list = await listBundledReleases('baofeng-dm32uv', false);
    expect(list.map((r) => r.key)).toContain('1.0.0');
    expect(list.every((r) => r.provenance === 'bundled')).toBe(true);
  });

  it('loads the bundled release by key', async () => {
    const [summary] = await listBundledReleases('baofeng-dm32uv', false);
    const loaded = await loadChosenPatch('baofeng-dm32uv', {
      kind: 'release',
      source: 'bundled',
      summary: summary!,
    });
    expect(loaded.provenance).toBe('bundled');
    expect(loaded.release?.tag).toBe(summary!.key);
  });

  it('passes FirmwareError codes through for a user file', async () => {
    const err = await loadChosenPatch('baofeng-dm32uv', {
      kind: 'user-patch',
      file: { name: 'x.json', bytes: new TextEncoder().encode('{"name":"nope","format":1}') },
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirmwareError);
    expect((err as FirmwareError).code).toBe('patch-unknown-format');
  });
});

describe('formatFirmwareFlashSummary provenance lines', () => {
  const base = {
    ok: false as const,
    radioId: 'baofeng-dm32uv' as const,
    code: 'x',
    message: 'm',
    position: 'p',
    radioTouched: false,
    startedAt: 'now',
  };
  const image = (extra: Record<string, unknown>) =>
    ({
      radioId: 'baofeng-dm32uv',
      stockVersion: 'v1',
      package: { radioId: 'baofeng-dm32uv', files: {} },
      sha256: {},
      verifyHint: '',
      ...extra,
    }) as unknown as PreparedFirmwareImage;

  it('names a bundled release', () => {
    const text = formatFirmwareFlashSummary({
      ...base,
      image: image({
        provenance: 'bundled',
        releaseTag: '1.0.0',
        patchSha256: 'aa',
        versionStamp: '1.0.0',
      }),
    });
    expect(text).toContain('Release 1.0.0 (bundled, patch sha256 aa)');
    expect(text).toContain('Version stamp: 1.0.0');
  });

  it('flags a user-supplied patch', () => {
    const text = formatFirmwareFlashSummary({
      ...base,
      image: image({ provenance: 'unreviewed', patchSha256: 'bb', patchVersion: '2.0.0' }),
    });
    expect(text).toContain('user-supplied patch, sha256 bb, version 2.0.0');
  });

  it('names stock', () => {
    const text = formatFirmwareFlashSummary({ ...base, image: image({ provenance: 'stock' }) });
    expect(text).toContain('Firmware: stock v1');
  });
});
