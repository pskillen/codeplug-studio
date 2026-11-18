import { expect, it } from 'vitest';
import { getRadioRfCapabilities } from '@core/radio-targets/rfCapabilities.ts';
import { UV5R_MINI_LIMITS } from './limits.ts';

it('keeps the air band aligned with the target capabilities', () => {
  const band = getRadioRfCapabilities('baofeng-uv5r-mini')?.frequencyRanges.find((r) =>
    r.modes.includes('am'),
  );
  expect(band).toBeDefined();
  expect(UV5R_MINI_LIMITS.AM_BAND_MIN_HZ).toBe(band!.minMhz * 1e6);
  expect(UV5R_MINI_LIMITS.AM_BAND_MAX_HZ).toBe(Math.round(band!.maxMhz * 1e6));
});
