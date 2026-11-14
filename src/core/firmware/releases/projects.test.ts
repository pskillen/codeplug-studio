import { describe, expect, it } from 'vitest';

import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import {
  releaseSupportsLine,
  FIRMWARE_PROJECTS,
  firmwareProjectDisplayName,
  firmwareReleaseTitle,
  stockFirmwareTitle,
  UNKNOWN_FIRMWARE_PROJECT_NAME,
} from './projects.ts';

describe('firmware projects', () => {
  it("names every radio's patch project", () => {
    for (const d of listStockFirmwareDescriptors()) {
      for (const name of d.patchNames) {
        expect(
          FIRMWARE_PROJECTS.some((p) => p.patchName === name),
          name,
        ).toBe(true);
      }
    }
  });

  it('titles a modded release by its project', () => {
    expect(firmwareReleaseTitle('baofeng-dm32-firmware', '1.0.0')).toBe(
      'MM9PDY modded firmware 1.0.0',
    );
    expect(firmwareReleaseTitle('anytone-d890-firmware', '1.0.0')).toBe(
      'MM9PDY modded firmware 1.0.0',
    );
    expect(firmwareReleaseTitle('baofeng-uv5rmini-firmware', '1.0.0')).toBe(
      'MM9PDY modded firmware 1.0.0',
    );
  });

  it('falls back for an unknown patch name and never calls stock MM9PDY', () => {
    expect(firmwareProjectDisplayName('someone-else')).toBe(UNKNOWN_FIRMWARE_PROJECT_NAME);
    expect(stockFirmwareTitle('v1.01.048')).toBe('stock firmware v1.01.048');
  });
});

describe('releaseSupportsLine', () => {
  it('names the radio and the stock versions a release is for', () => {
    expect(releaseSupportsLine('Baofeng UV-5R Mini', ['v0.27 (NRF)'])).toBe(
      'For the Baofeng UV-5R Mini on stock v0.27 (NRF)',
    );
    expect(releaseSupportsLine('Baofeng UV-5R Mini', ['v0.27 (NRF)', 'v0.04 (NRFB)'])).toBe(
      'For the Baofeng UV-5R Mini on stock v0.27 (NRF) or v0.04 (NRFB)',
    );
  });

  it('says nothing without stock versions', () => {
    expect(releaseSupportsLine('Baofeng DM-32UV', undefined)).toBeUndefined();
    expect(releaseSupportsLine('Baofeng DM-32UV', [])).toBeUndefined();
  });
});
