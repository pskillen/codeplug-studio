import { describe, expect, it } from 'vitest';
import { getRadioRfCapabilities } from '@core/radio-targets/rfCapabilities.ts';
import { DM32UV_RADIOFOUNDRY_BOARD, DM32UV_RADIOFOUNDRY_LIMITS } from './limits.ts';

describe('DM32UV_RADIOFOUNDRY_LIMITS', () => {
  it('keeps every value it had before the firmware/board split', () => {
    expect({ ...DM32UV_RADIOFOUNDRY_LIMITS }).toEqual({
      CHANNEL_MAX: 1024,
      ZONE_MAX: 68,
      ZONE_MEMBERS_MAX: 80,
      CONTACTS_MAX: 1024,
      ID_DATABASE_MAX: 287_629,
      RX_GROUPS_MAX: 76,
      RX_GROUP_MEMBERS_MAX: 32,
      NAME_MAX: 16,
      RADIO_NAME_MAX: 8,
      RADIO_IDS_MAX: 1,
      DMR_ID_MAX: 16_776_415,
      SATELLITE_MAX: 10,
      SATELLITE_NAME_MAX_BYTES: 48,
      SATELLITE_CATALOG_MAX: 99_999,
      SATELLITE_TONE_MIN_TENTHS: 600,
      SATELLITE_TONE_MAX_TENTHS: 2600,
      POWER_LEVELS: 9,
    });
  });
});

describe('DM32UV_RADIOFOUNDRY_BOARD', () => {
  it('ends the image where openfw_end meets the EEPROM base', () => {
    expect(DM32UV_RADIOFOUNDRY_BOARD.IMAGE_END).toBe(0xf00000 - 0x700000);
    expect(DM32UV_RADIOFOUNDRY_BOARD.PHYSICAL_CODEPLUG_BASE).toBe(0x700000);
  });

  it('keeps the RF capability row aligned with the board bands', () => {
    const caps = getRadioRfCapabilities('baofeng-dm32uv-radiofoundry');
    expect(caps).toBeDefined();
    expect(
      caps!.frequencyRanges.map((r) => [Math.round(r.minMhz * 1e6), Math.round(r.maxMhz * 1e6)]),
    ).toEqual(DM32UV_RADIOFOUNDRY_BOARD.BANDS_HZ.map((b) => [b.minHz, b.maxHz]));
    expect(caps!.supportedModes).toEqual(['fm', 'dmr', 'm17']);
  });
});
