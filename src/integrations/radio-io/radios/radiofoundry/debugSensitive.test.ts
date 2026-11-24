import { describe, expect, it } from 'vitest';
import {
  SETTINGS_AREA_ADDRESS,
  SETTINGS_AREA_SIZE,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  crc32,
  readRadioFoundrySettingsArea,
} from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import { EEPROM_IMAGE_END } from './constants.ts';
import { RADIOFOUNDRY_REGION } from './debugCapture.ts';
import { RADIOFOUNDRY_CABLE_BOARDS } from './board.ts';
import { radioFoundryArchiveSensitiveRanges } from './debugSensitive.ts';
import type { DebugSensitiveArchive } from '../../debugSensitive.ts';
import { RADIO_BACKUP_FORMAT, RADIO_BACKUP_VERSION } from '../../backup/types.ts';
import { OPENGD77_DM1701_MODEL_ID } from '../opengd77/hydration.ts';

function buildSector(
  data: number[],
  { version = 1, headerLength = 16 }: { version?: number; headerLength?: number } = {},
): Uint8Array {
  const s = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  const crc = crc32(Uint8Array.from(data));
  s.fill(0, 0, headerLength);
  s.set([0x52, 0x46, 0x4b, 0x56, version, headerLength, data.length & 0xff, data.length >> 8], 0);
  s.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], 8);
  s.set(data, headerLength);
  return s;
}

function archive(modelId: string, eeprom: Uint8Array): DebugSensitiveArchive {
  return {
    manifest: {
      format: RADIO_BACKUP_FORMAT,
      version: RADIO_BACKUP_VERSION,
      capturedAt: '2026-03-01T00:00:00.000Z',
      capturedVia: 'web-serial',
      app: { buildEnv: 'test', buildVersion: 'test' },
      radioModelId: modelId,
      descriptorLabel: 'test',
      coverage: 'partial',
      imageByteLength: eeprom.length,
      regions: [
        {
          id: RADIOFOUNDRY_REGION.eeprom,
          address: 0,
          byteLength: eeprom.length,
          label: 'EEPROM',
          path: 'regions/eeprom-image.bin',
          restoreRole: 'inspect-only',
        },
      ],
    },
    regions: { [RADIOFOUNDRY_REGION.eeprom]: eeprom },
    sidecars: {},
  };
}

describe('radioFoundryArchiveSensitiveRanges', () => {
  it('marks password and PIN on every RadioFoundry model id', () => {
    for (const board of RADIOFOUNDRY_CABLE_BOARDS) {
      const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
      const ranges = radioFoundryArchiveSensitiveRanges(
        archive(board.modelId, eeprom),
        RADIOFOUNDRY_REGION.eeprom,
      );
      expect(ranges).toEqual(
        expect.arrayContaining([
          { start: 0x100, end: 0x108, label: 'Codeplug password' },
          { start: 0x751c, end: 0x751f, label: 'Boot PIN' },
          { start: 0x1408, end: 0x1418, label: 'DTMF kill code' },
          { start: 0x1418, end: 0x1428, label: 'DTMF wake code' },
        ]),
      );
    }
  });

  it('returns nothing for an OpenGD77 archive or flash-image', () => {
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    expect(
      radioFoundryArchiveSensitiveRanges(
        archive(OPENGD77_DM1701_MODEL_ID, eeprom),
        RADIOFOUNDRY_REGION.eeprom,
      ),
    ).toEqual([]);
    expect(
      radioFoundryArchiveSensitiveRanges(
        archive('MD-9600-RadioFoundry', eeprom),
        RADIOFOUNDRY_REGION.flash,
      ),
    ).toEqual([]);
  });

  it('masks secret settings values at their offsets', () => {
    const key305 = Array.from({ length: 16 }, () => 0xaa);
    const key1902 = Array.from({ length: 32 }, () => 0xbb);
    const data = [
      0x01,
      0x00,
      0x01,
      0x00,
      0x11,
      0x05,
      0x03,
      0x10,
      0x00,
      ...key305,
      0x02,
      0x19,
      0x20,
      0x00,
      ...key1902,
    ];
    const sector = buildSector(data);
    expect(readRadioFoundrySettingsArea(sector).state).toBe('valid');
    const parsed = readRadioFoundrySettingsArea(sector);
    const secret305 = parsed.entries.find((e) => e.key === 0x0305)!;
    const secret1902 = parsed.entries.find((e) => e.key === 0x1902)!;
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const off305 = SETTINGS_AREA_ADDRESS + secret305.offset;
    const off1902 = SETTINGS_AREA_ADDRESS + secret1902.offset;
    const ranges = radioFoundryArchiveSensitiveRanges(
      archive('MD-9600-RadioFoundry', eeprom),
      RADIOFOUNDRY_REGION.eeprom,
    );
    expect(ranges).toEqual(
      expect.arrayContaining([
        { start: off305, end: off305 + 16, label: 'System secret 0x0305' },
        { start: off1902, end: off1902 + 32, label: 'Traffic key 0x1902' },
      ]),
    );
  });

  it('moves masked values when the header length is 24', () => {
    const data = [0x05, 0x03, 0x10, 0x00, ...Array.from({ length: 16 }, () => 0xcc)];
    const sector = buildSector(data, { headerLength: 24 });
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const ranges = radioFoundryArchiveSensitiveRanges(
      archive('MD-9600-RadioFoundry', eeprom),
      RADIOFOUNDRY_REGION.eeprom,
    );
    const entryOffset = 24 + 4;
    expect(ranges).toEqual(
      expect.arrayContaining([
        {
          start: SETTINGS_AREA_ADDRESS + entryOffset,
          end: SETTINGS_AREA_ADDRESS + entryOffset + 16,
          label: 'System secret 0x0305',
        },
      ]),
    );
  });

  it.each(['bad', 'newer'] as const)('masks the whole sector when settings are %s', (state) => {
    let sector: Uint8Array;
    if (state === 'bad') {
      sector = new Uint8Array(SETTINGS_AREA_SIZE).fill(0x00);
    } else {
      sector = buildSector([], { version: 2 });
    }
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const ranges = radioFoundryArchiveSensitiveRanges(
      archive('MD-9600-RadioFoundry', eeprom),
      RADIOFOUNDRY_REGION.eeprom,
    );
    expect(ranges).toEqual(
      expect.arrayContaining([
        {
          start: SETTINGS_AREA_ADDRESS,
          end: SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE,
          label: 'Settings area (unreadable, masked whole)',
        },
      ]),
    );
  });

  it('masks nothing extra when the settings area is empty', () => {
    const sector = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const ranges = radioFoundryArchiveSensitiveRanges(
      archive('MD-9600-RadioFoundry', eeprom),
      RADIOFOUNDRY_REGION.eeprom,
    );
    expect(ranges.filter((r) => r.label.includes('Settings'))).toEqual([]);
  });

  it('adds the continuation span when header bytes 12–15 are non-zero', () => {
    const sector = buildSector([0x01, 0x00, 0x01, 0x00, 0x39]);
    sector[12] = 1;
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const ranges = radioFoundryArchiveSensitiveRanges(
      archive('MD-9600-RadioFoundry', eeprom),
      RADIOFOUNDRY_REGION.eeprom,
    );
    expect(ranges).toEqual(
      expect.arrayContaining([
        { start: 0xf000, end: 0x10000, label: 'Settings area continuation' },
      ]),
    );
  });
});
