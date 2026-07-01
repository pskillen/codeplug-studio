import { describe, expect, it } from 'vitest';
import { bandForFrequencyHz, bandLabelForFrequencyHz } from './bandPlan.ts';

describe('bandPlan', () => {
  it('identifies the 2m band', () => {
    expect(bandLabelForFrequencyHz(145_725_000)).toBe('2 m');
  });

  it('identifies the 70cm band', () => {
    expect(bandLabelForFrequencyHz(439_000_000)).toBe('70 cm');
  });

  it('returns the full allocation', () => {
    const band = bandForFrequencyHz(145_500_000);
    expect(band?.label).toBe('2 m');
    expect(band?.service).toBe('amateur');
  });

  it('identifies broadcast and PMR bands', () => {
    expect(bandLabelForFrequencyHz(95_000_000)).toBe('FM broadcast');
    expect(bandLabelForFrequencyHz(446_100_000)).toBe('PMR446');
  });

  it('returns null/— for out-of-band and missing frequencies', () => {
    expect(bandForFrequencyHz(null)).toBeNull();
    expect(bandLabelForFrequencyHz(999_000_000)).toBe('—');
  });
});
