import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { packRadioBackupZip } from '../../backup/pack.ts';
import { RADIO_BACKUP_FORMAT, RADIO_BACKUP_VERSION } from '../../backup/types.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import {
  buildDm32CalibrationBackupSidecars,
  decodeDm32CalibrationPage,
  decodeDm32FactorySector,
  type Dm32CalibrationBackupJson,
} from './calibrationDecode.ts';

function page(): Uint8Array {
  const data = new Uint8Array(DM32_BLOCK_SIZE);
  data[0x000] = 0x00;
  data[0x001] = 0x40;
  data[0x002] = 0x00;
  data[0x003] = 0x47;
  data[0x0cc] = 0x60;
  data[0x0cd] = 0x13;
  data[0x0ce] = 0x40;
  data[0x0cf] = 0x17;
  data[0x017] = 0x11;
  data[0x018] = 0x22;
  data[0x019] = 0x33;
  data[0x01a] = 0x44;
  data[0x01b] = 0x55;
  data[0x030] = 0xab;
  data[DM32_BLOCK_SIZE - 1] = DM32_METADATA.CALIBRATION;
  return data;
}

describe('decodeDm32CalibrationPage', () => {
  it('decodes BCD band limits and keeps unknown rows', () => {
    const decoded = decodeDm32CalibrationPage(page(), 0xb8000);
    expect(decoded.address).toBe(0xb8000);
    expect(decoded.tag).toBe(0x02);
    expect(decoded.uhfBand).toEqual({ lowHz: 400_000_000, highHz: 470_000_000 });
    expect(decoded.vhfBand).toEqual({ lowHz: 136_000_000, highHz: 174_000_000 });
    const unknown = decoded.unknownRows.find((row) => row.offset === 0x017);
    expect(unknown).toEqual({ offset: 0x017, length: 5, hex: '1122334455' });
    expect(decoded.unknownRows.some((row) => row.offset === 0x030)).toBe(true);
    expect(decoded.unknownRows.some((row) => row.offset === 0x150)).toBe(true);
  });
});

describe('decodeDm32FactorySector', () => {
  it('reads the GPS bit, TX region, and anti-clone key', () => {
    const data = new Uint8Array(4096);
    data[0x80] = 0x04;
    data[0xa1] = 0xa5;
    data[0x10c] = 0x01;
    data[0x10d] = 0x02;
    data[0x10e] = 0x03;
    data[0x10f] = 0x04;
    const decoded = decodeDm32FactorySector(data);
    expect(decoded.gpsEnabled).toBe(true);
    expect(decoded.txRegion).toBe(0xa5);
    expect(decoded.txRegionUnrestricted).toBe(true);
    expect(decoded.antiCloneKeyHex).toBe('01020304');
    expect(decoded.address).toBe(0x0300b000);
  });
});

describe('buildDm32CalibrationBackupSidecars', () => {
  it('records the live page, a duplicate, and the eFuse UID without a serial field', async () => {
    const live = page();
    const duplicate = page();
    duplicate[0x017] = 0x99;
    const sidecars = await buildDm32CalibrationBackupSidecars({
      blocks: [
        { address: 0xc0000, data: duplicate },
        { address: 0xb8000, data: live },
        { address: 0x105000, data: page() },
      ],
      window: { start: 0x1000, end: 0xc8000 },
      efuse: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
      factorySector: null,
      factoryNotKeptReason: 'mismatch',
    });
    const json = JSON.parse(strFromU8(sidecars['calibration.json']!)) as Dm32CalibrationBackupJson;
    expect(json.liveAddress).toBe(0xb8000);
    expect(json.tag).toBe(0x02);
    expect(json.duplicateAddresses).toEqual([0xc0000]);
    expect(json.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(json.efuseUidHex).toBe('0102030405060708');
    expect(json.efuseDerivedHex).toBe('090a0b0c');
    expect(json).not.toHaveProperty('serial');
    const factory = JSON.parse(strFromU8(sidecars['factory-sector.json']!)) as { kept: boolean };
    expect(factory).toEqual({ kept: false, reason: 'mismatch' });
    const packed = unzipSync(
      packRadioBackupZip(
        {
          format: RADIO_BACKUP_FORMAT,
          version: RADIO_BACKUP_VERSION,
          capturedAt: '2026-10-20T12:00:00.000Z',
          capturedVia: 'web-serial',
          app: { buildEnv: 'test', buildVersion: '0' },
          radioModelId: 'DM-32UV',
          descriptorLabel: 'Baofeng DM-32UV',
          coverage: 'known-map-regions',
          imageByteLength: DM32_BLOCK_SIZE,
          regions: [
            {
              id: 'region-0x1000',
              label: 'Region',
              address: 0x1000,
              byteLength: 4,
              path: 'regions/region-0x1000.bin',
              restoreRole: 'restorable',
            },
          ],
        },
        { 'region-0x1000': new Uint8Array([1, 2, 3, 4]) },
        sidecars,
      ),
    );
    expect(packed['calibration.json']).toBeTruthy();
    expect(packed['manifest.json']).toBeTruthy();
    expect(strFromU8(packed['manifest.json']!)).not.toMatch(/"serial"/);
  });
});
