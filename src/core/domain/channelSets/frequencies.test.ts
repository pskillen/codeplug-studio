import { describe, expect, it } from 'vitest';
import {
  UK_UHF_SIMPLEX_HZ,
  UK_VHF_SIMPLEX_HZ,
  UK_VHF_SIMPLEX_LEGACY_S_HZ,
  buildLinearGridHz,
  euCbCeptTemplates,
  pmr446Templates,
  ukCb2781Templates,
  ukUhfSimplexLegacyTemplates,
  ukUhfSimplexUTemplates,
  ukVhfSimplexLegacySName,
  ukVhfSimplexSTemplates,
  ukVhfSimplexVTemplates,
} from './frequencies.ts';

describe('buildLinearGridHz', () => {
  it('builds evenly spaced grids', () => {
    expect(buildLinearGridHz(100, 3, 10)).toEqual([100, 110, 120]);
  });
});

describe('PMR446', () => {
  it('has 16 channels from 446.00625 to 446.19375 MHz', () => {
    const templates = pmr446Templates();
    expect(templates).toHaveLength(16);
    expect(templates[0]?.rxFrequencyHz).toBe(446_006_250);
    expect(templates[15]?.rxFrequencyHz).toBe(446_193_750);
    expect(templates[0]?.name).toBe('PMR446-1');
  });
});

describe('UK VHF simplex', () => {
  it('has 30 channels V16–V45', () => {
    const templates = ukVhfSimplexVTemplates();
    expect(templates).toHaveLength(30);
    expect(templates[0]?.name).toBe('V16');
    expect(templates[29]?.name).toBe('V45');
    expect(UK_VHF_SIMPLEX_HZ[0]).toBe(145_200_000);
    expect(UK_VHF_SIMPLEX_HZ[29]).toBe(145_562_500);
  });

  it('places V40 calling at 145.500 MHz', () => {
    const templates = ukVhfSimplexVTemplates();
    const v40 = templates.find((t) => t.name === 'V40');
    expect(v40?.rxFrequencyHz).toBe(145_500_000);
  });

  it('legacy S-set has S08–S23 with S20 at calling frequency', () => {
    const sTemplates = ukVhfSimplexSTemplates();
    expect(sTemplates).toHaveLength(16);
    expect(sTemplates[0]?.name).toBe('S08');
    expect(sTemplates[15]?.name).toBe('S23');
    expect(UK_VHF_SIMPLEX_LEGACY_S_HZ).toHaveLength(16);
    expect(ukVhfSimplexLegacySName(12)).toBe('S20');
    const s20 = sTemplates.find((t) => t.name === 'S20');
    expect(s20?.rxFrequencyHz).toBe(145_500_000);
  });
});

describe('UK UHF simplex', () => {
  it('has 17 channels U272–U288', () => {
    const templates = ukUhfSimplexUTemplates();
    expect(templates).toHaveLength(17);
    expect(templates[0]?.name).toBe('U272');
    expect(templates[16]?.name).toBe('U288');
    expect(UK_UHF_SIMPLEX_HZ[0]).toBe(433_400_000);
    expect(UK_UHF_SIMPLEX_HZ[16]).toBe(433_600_000);
  });

  it('places U280 and legacy SU24 calling at 433.500 MHz', () => {
    const uTemplates = ukUhfSimplexUTemplates();
    const legacy = ukUhfSimplexLegacyTemplates();
    expect(uTemplates.find((t) => t.name === 'U280')?.rxFrequencyHz).toBe(433_500_000);
    expect(legacy.find((t) => t.name === 'SU24')?.rxFrequencyHz).toBe(433_500_000);
  });
});

describe('CB sets', () => {
  it('UK CB has 40 channels', () => {
    expect(ukCb2781Templates()).toHaveLength(40);
  });

  it('EU CB has 40 channels ending at 27.355 MHz', () => {
    const templates = euCbCeptTemplates();
    expect(templates).toHaveLength(40);
    expect(templates[39]?.rxFrequencyHz).toBe(27_355_000);
  });
});
