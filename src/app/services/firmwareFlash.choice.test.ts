import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareError } from '@core/firmware/errors.ts';
import { syntheticDm32Release } from '@core/firmware/releases/__fixtures__/syntheticReleases.ts';
import type {
  LoadedFirmwarePatch,
  PublishedFirmwareRelease,
} from '@core/firmware/releases/types.ts';
import * as prepareModule from '@core/services/firmware/prepareFirmwareImage.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import * as radioIo from '@integrations/radio-io';
import type { FirmwareUpdater } from '@integrations/radio-io';

import {
  formatFirmwareFlashSummary,
  listPublishedReleases,
  loadChosenPatch,
  prepareFlash,
  type VerifiedStockFirmware,
} from './firmwareFlash.ts';

const checkImage = vi.fn();
const publishedRows = vi.fn<() => Promise<readonly PublishedFirmwareRelease[]>>();

vi.mock('@integrations/firmware-releases/publicReleaseIndex.ts', () => ({
  createPublicReleaseIndexLoader: () => () => publishedRows(),
}));

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
const LOADED = { provenance: 'published' } as unknown as LoadedFirmwarePatch;

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

describe('published releases and chosen patches', () => {
  beforeEach(() => {
    publishedRows.mockReset();
  });

  it('lists the published finals for the radio', async () => {
    const { row } = await syntheticDm32Release();
    publishedRows.mockResolvedValue([row, { ...row, tag: '9.9.9-rc.1', channel: 'rc' }]);
    const list = await listPublishedReleases('baofeng-dm32uv', false);
    expect(list.map((r) => r.key)).toEqual([row.tag]);
    expect(list.every((r) => r.provenance === 'published')).toBe(true);
  });

  it('passes a release-list failure through', async () => {
    publishedRows.mockImplementation(async () => {
      throw new FirmwareError('patch-unreadable', 'offline');
    });
    await expect(listPublishedReleases('baofeng-dm32uv', false)).rejects.toThrow('offline');
  });

  it('still reads a user file when the release list cannot be fetched', async () => {
    publishedRows.mockImplementation(async () => {
      throw new FirmwareError('patch-unreadable', 'offline');
    });
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

  it('names a published release', () => {
    const text = formatFirmwareFlashSummary({
      ...base,
      image: image({
        provenance: 'published',
        releaseTag: '1.0.0',
        title: 'MM9PDY modded firmware 1.0.0',
        patchSha256: 'aa',
        versionStamp: '1.0.0',
      }),
    });
    expect(text).toContain('Firmware: MM9PDY modded firmware 1.0.0 (published, patch sha256 aa)');
    expect(text).toContain('Version stamp: 1.0.0');
  });

  it('flags a user-supplied patch', () => {
    const text = formatFirmwareFlashSummary({
      ...base,
      image: image({
        provenance: 'unreviewed',
        title: 'MM9PDY modded firmware 2.0.0',
        patchSha256: 'bb',
        patchVersion: '2.0.0',
      }),
    });
    expect(text).toContain(
      'Firmware: MM9PDY modded firmware 2.0.0 (user-supplied patch, sha256 bb, version 2.0.0)',
    );
  });

  it('names stock', () => {
    const text = formatFirmwareFlashSummary({
      ...base,
      image: image({ provenance: 'stock', title: 'stock firmware v1' }),
    });
    expect(text).toContain('Firmware: stock firmware v1');
    expect(text).not.toContain('MM9PDY');
  });
});
