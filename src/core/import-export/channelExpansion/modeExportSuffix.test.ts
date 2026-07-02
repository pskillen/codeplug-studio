import { describe, expect, it } from 'vitest';
import {
  expansionWireKey,
  modeExportNameSuffix,
  peelModeExportSuffix,
} from './modeExportSuffix.ts';

describe('modeExportNameSuffix', () => {
  it('uses -F for analog modes', () => {
    expect(modeExportNameSuffix('fm')).toBe('-F');
    expect(modeExportNameSuffix('am')).toBe('-F');
  });

  it('uses mode-specific suffixes for digital modes', () => {
    expect(modeExportNameSuffix('dmr')).toBe('-D');
    expect(modeExportNameSuffix('dstar')).toBe('-DS');
    expect(modeExportNameSuffix('ysf')).toBe('-Y');
    expect(modeExportNameSuffix('p25')).toBe('-P25');
    expect(modeExportNameSuffix('nxdn')).toBe('-NX');
    expect(modeExportNameSuffix('m17')).toBe('-M17');
    expect(modeExportNameSuffix('tetra')).toBe('-T');
  });

  it('builds expansion override keys from channel id and suffix', () => {
    expect(expansionWireKey('ch-1', 'ysf')).toBe('ch-1:-Y');
    expect(expansionWireKey('ch-1', 'dstar')).toBe('ch-1:-DS');
  });
});

describe('peelModeExportSuffix', () => {
  it('peels longest matching mode suffix first', () => {
    expect(peelModeExportSuffix('GB7GL Glasgow-DS')).toEqual({
      stem: 'GB7GL Glasgow',
      suffix: '-DS',
    });
    expect(peelModeExportSuffix('GB7GL Glasgow-D')).toEqual({
      stem: 'GB7GL Glasgow',
      suffix: '-D',
    });
    expect(peelModeExportSuffix('GB7GL Glasgow-F')).toEqual({
      stem: 'GB7GL Glasgow',
      suffix: '-F',
    });
  });

  it('returns empty suffix when none is present', () => {
    expect(peelModeExportSuffix('GB7GL Glasgow')).toEqual({
      stem: 'GB7GL Glasgow',
      suffix: '',
    });
  });
});
