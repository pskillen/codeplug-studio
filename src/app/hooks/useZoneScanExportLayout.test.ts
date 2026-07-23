import { describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { zoneGroupingLayoutSupported, zoneScanExportSupported } from './useZoneScanExportLayout.ts';

function buildStub(profileId: string) {
  return newRadioBuildForProfile('p1', profileId).build;
}

describe('zoneScanExportSupported', () => {
  it('is true for DM32 (ZoneGrouping + ScanLists)', () => {
    expect(zoneScanExportSupported(buildStub('dm32-baofeng-dm32uv'))).toBe(true);
  });

  it('is true for Anytone (ZoneGrouping + DedicatedScanLists)', () => {
    expect(zoneScanExportSupported(buildStub('anytone-at-d890uv'))).toBe(true);
  });

  it('is false for OpenGD77 (ZoneAsScanList only, no zone-derived scan panel)', () => {
    expect(zoneScanExportSupported(buildStub('opengd77-1701'))).toBe(false);
  });

  it('is false for CHIRP (no ZoneGrouping)', () => {
    expect(zoneScanExportSupported(buildStub('chirp-uv5r'))).toBe(false);
  });
});

describe('zoneGroupingLayoutSupported', () => {
  it('is true for OpenGD77 and DM32', () => {
    expect(zoneGroupingLayoutSupported(buildStub('opengd77-1701'))).toBe(true);
    expect(zoneGroupingLayoutSupported(buildStub('dm32-baofeng-dm32uv'))).toBe(true);
  });

  it('is false for CHIRP', () => {
    expect(zoneGroupingLayoutSupported(buildStub('chirp-uv5r'))).toBe(false);
  });
});
