import { describe, expect, it } from 'vitest';
import { SETTINGS_AREA_ADDRESS, SETTINGS_AREA_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import { crc32, readRadioFoundrySettingsArea } from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import { EEPROM_IMAGE_END } from './constants.ts';
import { RADIOFOUNDRY_REGION } from './debugCapture.ts';
import { radioFoundrySettingsView } from './debugSettingsView.ts';
import { isRadioFoundrySecretKey } from './debugSensitive.ts';

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

function archive(eeprom: Uint8Array) {
  return {
    manifest: {
      radioModelId: 'MD-9600-RadioFoundry',
      regions: [{ id: RADIOFOUNDRY_REGION.eeprom }],
    },
    regions: { [RADIOFOUNDRY_REGION.eeprom]: eeprom },
  };
}

describe('isRadioFoundrySecretKey', () => {
  it('marks the secret families only', () => {
    expect(isRadioFoundrySecretKey(0x0305)).toBe(true);
    expect(isRadioFoundrySecretKey(0x1902)).toBe(true);
    expect(isRadioFoundrySecretKey(0x0001)).toBe(false);
  });
});

describe('radioFoundrySettingsView', () => {
  it('lists valid entries with sensitive flags and addresses', () => {
    const key305 = Array(16).fill(0xaa);
    const key1902 = Array(32).fill(0xbb);
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
    const parsed = readRadioFoundrySettingsArea(sector);
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const view = radioFoundrySettingsView(archive(eeprom));
    expect(view.status).toEqual({ kind: 'ok' });
    const rows = view.groups[0]!.rows;
    expect(rows.find((r) => r.label === 'Key 0x0001')!.sensitive).toBe(false);
    expect(rows.find((r) => r.label === 'Key 0x0305')!.sensitive).toBe(true);
    expect(rows.find((r) => r.label === 'Key 0x1902')!.sensitive).toBe(true);
    const secret = parsed.entries.find((e) => e.key === 0x0305)!;
    expect(rows.find((r) => r.label === 'Key 0x0305')!.address).toBe(
      `0x${(SETTINGS_AREA_ADDRESS + secret.offset).toString(16)}`,
    );
  });

  it('shifts addresses when the header length is 24', () => {
    const data = [0x05, 0x03, 0x10, 0x00, ...Array(16).fill(0xcc)];
    const sector = buildSector(data, { headerLength: 24 });
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const row = radioFoundrySettingsView(archive(eeprom)).groups[0]!.rows[0]!;
    expect(row.address).toBe(`0x${(SETTINGS_AREA_ADDRESS + 24 + 4).toString(16)}`);
  });

  it.each([
    ['bad', () => buildSector([0x01, 0x00, 0xff, 0x00, 0x00])],
    ['newer', () => buildSector([], { version: 2 })],
    ['empty', () => new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff)],
  ])('handles %s settings area', (state, sectorFn) => {
    const sector = sectorFn();
    if (state === 'bad') sector[16] ^= 0xff;
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const view = radioFoundrySettingsView(archive(eeprom));
    if (state === 'empty') expect(view.status).toEqual({ kind: 'ok' });
    else expect(view.status?.kind).toBe('ambiguous');
  });

  it('marks duplicate keys', () => {
    const sector = buildSector([0x05, 0x00, 0x01, 0x00, 0x11, 0x05, 0x00, 0x01, 0x00, 0x22]);
    const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
    eeprom.set(sector, SETTINGS_AREA_ADDRESS);
    const rows = radioFoundrySettingsView(archive(eeprom)).groups[0]!.rows;
    expect(rows[1]!.evidence).toMatch(/duplicate/);
  });

  it('says not captured when the EEPROM region is missing', () => {
    expect(
      radioFoundrySettingsView({
        manifest: { radioModelId: 'MD-9600-RadioFoundry', regions: [] },
        regions: {},
      }).status,
    ).toEqual({
      kind: 'not-captured',
      reason: 'The EEPROM image was not captured.',
    });
  });
});