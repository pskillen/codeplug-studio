import { describe, expect, it } from 'vitest';
import { bandForFrequencyHz, bandLabelForFrequencyHz } from './bandPlan.ts';

describe('bandPlan', () => {
  it('identifies the 2m band', () => {
    expect(bandLabelForFrequencyHz(145_725_000)).toBe('2M');
  });

  it('identifies the 70cm band', () => {
    expect(bandLabelForFrequencyHz(439_000_000)).toBe('70CM');
  });

  it('returns the full allocation', () => {
    const band = bandForFrequencyHz(145_500_000);
    expect(band?.name).toContain('2 metres');
    expect(band?.service).toBe('amateur');
  });

  it('returns null/— for out-of-band and missing frequencies', () => {
    expect(bandForFrequencyHz(null)).toBeNull();
    expect(bandLabelForFrequencyHz(999_000_000)).toBe('—');
  });
});
