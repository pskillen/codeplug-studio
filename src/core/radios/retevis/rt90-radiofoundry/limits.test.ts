import { describe, expect, it } from 'vitest';
import { getRadioRfCapabilities } from '@core/radio-targets/rfCapabilities.ts';
import { RT90_RADIOFOUNDRY_BOARD } from './limits.ts';

describe('RT90_RADIOFOUNDRY_BOARD', () => {
  it('holds the board facts', () => {
    expect(RT90_RADIOFOUNDRY_BOARD.BANDS_HZ).toEqual([
      { minHz: 136_000_000, maxHz: 174_000_000 },
      { minHz: 400_000_000, maxHz: 480_000_000 },
    ]);
    expect(RT90_RADIOFOUNDRY_BOARD.POWER_LEVELS).toBe(5);
    expect(RT90_RADIOFOUNDRY_BOARD.POWER_LABELS).toEqual([
      '250 mW VHF / 100 mW UHF',
      '1 W',
      '5 W',
      '25 W',
      '50 W VHF / 45 W UHF',
    ]);
    expect(RT90_RADIOFOUNDRY_BOARD.ID_DATABASE_MAX).toBe(520_646);
    expect(RT90_RADIOFOUNDRY_BOARD.PHYSICAL_CODEPLUG_BASE).toBe(0);
    expect(RT90_RADIOFOUNDRY_BOARD.IMAGE_END).toBe(0xe0_0000);
  });

  it('gives the RF row the board bands', () => {
    const caps = getRadioRfCapabilities('retevis-rt90-radiofoundry');
    expect(caps?.supportedModes).toEqual(['fm', 'dmr']);
    expect(caps?.frequencyRanges).toEqual([
      { minMhz: 136, maxMhz: 174, modes: ['fm', 'dmr'] },
      { minMhz: 400, maxMhz: 480, modes: ['fm', 'dmr'] },
    ]);
  });
});