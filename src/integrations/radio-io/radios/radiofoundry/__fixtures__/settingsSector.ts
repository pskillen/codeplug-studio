import {
  SETTINGS_AREA_ADDRESS,
  SETTINGS_AREA_SIZE,
} from '@core/import-export/formats/radiofoundry/layout.ts';
import { crc32 } from '@core/import-export/formats/radiofoundry/settingsArea.ts';
import { BLOCK_SIZE, EEPROM_IMAGE_END } from '../constants.ts';
import { FakeRadioFoundryRadio, type FakeRadioFoundryOptions } from './fakeRadioFoundryRadio.ts';

export function eepromWithSecretKey0305(): Uint8Array {
  const data = [0x05, 0x03, 0x04, 0x00, 0xde, 0xad, 0xbe, 0xef];
  const sector = new Uint8Array(SETTINGS_AREA_SIZE).fill(0xff);
  const crc = crc32(Uint8Array.from(data));
  sector.set([0x52, 0x46, 0x4b, 0x56, 1, 16, data.length & 0xff, data.length >> 8], 0);
  sector.set([crc & 0xff, (crc >>> 8) & 0xff, (crc >>> 16) & 0xff, (crc >>> 24) & 0xff], 8);
  sector.set(data, 16);
  const eeprom = new Uint8Array(EEPROM_IMAGE_END).fill(0xff);
  eeprom.set(sector, SETTINGS_AREA_ADDRESS);
  return eeprom;
}

/** A fake radio whose 0xE000 block is `sector` (4096 bytes, tail 0xFF if shorter). */
export function radioWithSettingsSector(
  sector: Uint8Array,
  options?: FakeRadioFoundryOptions,
): FakeRadioFoundryRadio {
  const radio = new FakeRadioFoundryRadio(options);
  const block = new Uint8Array(BLOCK_SIZE);
  block.fill(0xff);
  block.set(sector.subarray(0, Math.min(sector.length, SETTINGS_AREA_SIZE)));
  radio.setBlock(SETTINGS_AREA_ADDRESS, block);
  return radio;
}
