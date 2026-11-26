import { describe, expect, it } from 'vitest';
import { getRadioRfCapabilities } from '@core/radio-targets/rfCapabilities.ts';
import { DM1701_RADIOFOUNDRY_BOARD } from './limits.ts';

describe('DM1701_RADIOFOUNDRY_BOARD', () => {
  it('holds the board facts', () => {
    expect(DM1701_RADIOFOUNDRY_BOARD.BANDS_HZ).toEqual([
      { minHz: 136_000_000, maxHz: 174_000_000 },
      { minHz: 400_000_000, maxHz: 480_000_000 },
    ]);
    expect(DM1701_RADIOFOUNDRY_BOARD.POWER_LEVELS).toBe(5);
    expect(DM1701_RADIOFOUNDRY_BOARD.POWER_LABELS).toEqual([
      '100 mW',
      '500 mW',
      '1 W',
      '2.5 W',
      '5 W',
    ]);
    expect(DM1701_RADIOFOUNDRY_BOARD.ID_DATABASE_MAX).toBe(520_646);
    expect(DM1701_RADIOFOUNDRY_BOARD.PHYSICAL_CODEPLUG_BASE).toBe(0);
    expect(DM1701_RADIOFOUNDRY_BOARD.IMAGE_END).toBe(0xe0_0000);
  });

  it('gives the RF row the board bands', () => {
    const caps = getRadioRfCapabilities('baofeng-dm1701-radiofoundry');
    expect(caps?.supportedModes).toEqual(['fm', 'dmr', 'm17']);
    expect(caps?.frequencyRanges).toEqual([
      { minMhz: 136, maxMhz: 174, modes: ['fm', 'dmr', 'm17'] },
      { minMhz: 400, maxMhz: 480, modes: ['fm', 'dmr', 'm17'] },
    ]);
  });
});
