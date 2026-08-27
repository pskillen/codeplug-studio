import { describe, expect, it } from 'vitest';
import { GRADIENT_SEGMENT_IDLE_VALUE } from '../components/ui/GradientSegmentedControl.tsx';
import {
  BULK_POWER_CUSTOM,
  BULK_POWER_DEFAULT,
  bulkPowerSegmentValue,
  sharedPowerSegmentValue,
} from './bulkEditIdle.ts';

describe('bulkPowerSegmentValue', () => {
  it('is idle when power is not opted in', () => {
    expect(bulkPowerSegmentValue(false, 50)).toBe(GRADIENT_SEGMENT_IDLE_VALUE);
  });

  it('uses Default when opted in with a null power', () => {
    expect(bulkPowerSegmentValue(true, null)).toBe(BULK_POWER_DEFAULT);
  });

  it('uses Custom when opted in with a percent', () => {
    expect(bulkPowerSegmentValue(true, 50)).toBe(BULK_POWER_CUSTOM);
  });
});

describe('sharedPowerSegmentValue', () => {
  it('is undefined when the selection is mixed', () => {
    expect(sharedPowerSegmentValue(undefined)).toBeUndefined();
  });

  it('maps radio default and percents onto Default and Custom', () => {
    expect(sharedPowerSegmentValue(null)).toBe(BULK_POWER_DEFAULT);
    expect(sharedPowerSegmentValue(25)).toBe(BULK_POWER_CUSTOM);
  });
});
