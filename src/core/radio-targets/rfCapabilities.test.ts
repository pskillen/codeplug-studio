import { describe, expect, it } from 'vitest';
import { getRadioRfCapabilities } from './rfCapabilities.ts';

describe('getRadioRfCapabilities', () => {
  it('keeps the DM-32UV RadioFoundry RF row', () => {
    expect(getRadioRfCapabilities('baofeng-dm32uv-radiofoundry')).toEqual({
      radioTargetId: 'baofeng-dm32uv-radiofoundry',
      supportedModes: ['fm', 'dmr', 'm17'],
      frequencyRanges: [
        { minMhz: 136, maxMhz: 174, modes: ['fm', 'dmr', 'm17'] },
        { minMhz: 400, maxMhz: 480, modes: ['fm', 'dmr', 'm17'] },
      ],
    });
  });
});
