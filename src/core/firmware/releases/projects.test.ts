import { describe, expect, it } from 'vitest';

import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import {
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
  });

  it('falls back for an unknown patch name and never calls stock MM9PDY', () => {
    expect(firmwareProjectDisplayName('someone-else')).toBe(UNKNOWN_FIRMWARE_PROJECT_NAME);
    expect(stockFirmwareTitle('v1.01.048')).toBe('stock firmware v1.01.048');
  });
});
