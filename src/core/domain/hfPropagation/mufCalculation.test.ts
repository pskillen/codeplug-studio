import { describe, expect, it } from 'vitest';
import { criticalFrequencyMhz, maximumUsableFrequencyMhz } from './mufCalculation.ts';

describe('criticalFrequencyMhz', () => {
  it('returns 0 for non-positive density', () => {
    expect(criticalFrequencyMhz(0)).toBe(0);
    expect(criticalFrequencyMhz(-1)).toBe(0);
  });

  it('is in the low single-digit MHz range for typical daytime F2 density', () => {
    expect(criticalFrequencyMhz(1e12)).toBeCloseTo(9, 5);
  });
});

describe('maximumUsableFrequencyMhz', () => {
  it('equals fc for vertical incidence (NVIS, 90° takeoff)', () => {
    const fc = 9;
    expect(maximumUsableFrequencyMhz(fc, 90)).toBeCloseTo(fc);
  });

  it('increases monotonically as takeoff angle decreases toward the horizon', () => {
    const fc = 9;
    const at90 = maximumUsableFrequencyMhz(fc, 90);
    const at45 = maximumUsableFrequencyMhz(fc, 45);
    const at20 = maximumUsableFrequencyMhz(fc, 20);
    expect(at45).toBeGreaterThan(at90);
    expect(at20).toBeGreaterThan(at45);
  });
});
