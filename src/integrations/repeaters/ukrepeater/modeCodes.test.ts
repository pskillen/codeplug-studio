import { describe, expect, it } from 'vitest';
import {
  isOperationalStatus,
  parseUkRepeaterModeCodes,
  primaryModeFromModes,
} from './modeCodes.ts';

describe('parseUkRepeaterModeCodes', () => {
  it('parses analogue only', () => {
    expect(parseUkRepeaterModeCodes(['A'])).toEqual({
      modes: ['fm'],
      primaryMode: 'fm',
      colourCode: null,
    });
  });

  it('parses DMR with colour code from M:n', () => {
    expect(parseUkRepeaterModeCodes(['M:1'])).toEqual({
      modes: ['dmr'],
      primaryMode: 'dmr',
      colourCode: 1,
    });
  });

  it('parses multi-mode GB7DC style listing', () => {
    expect(parseUkRepeaterModeCodes(['A', 'D', 'M:1', 'F', 'P', 'N'])).toEqual({
      modes: ['fm', 'dmr', 'dstar', 'ysf', 'p25', 'nxdn'],
      primaryMode: 'fm',
      colourCode: 1,
    });
  });

  it('maps Fusion flag to YSF', () => {
    expect(parseUkRepeaterModeCodes(['A', 'F']).modes).toEqual(['fm', 'ysf']);
  });

  it('maps D flag to D-STAR not DMR', () => {
    expect(parseUkRepeaterModeCodes(['D']).modes).toEqual(['dstar']);
    expect(parseUkRepeaterModeCodes(['D']).primaryMode).toBe('dstar');
  });

  it('parses Tetra and M17 flags', () => {
    expect(parseUkRepeaterModeCodes(['E', '7']).modes).toEqual(['m17', 'tetra']);
  });
});

describe('primaryModeFromModes', () => {
  it('prefers FM when analogue is present', () => {
    expect(primaryModeFromModes(['dmr', 'fm'])).toBe('fm');
  });
});

describe('isOperationalStatus', () => {
  it('matches OPERATIONAL case-insensitively', () => {
    expect(isOperationalStatus('OPERATIONAL')).toBe(true);
    expect(isOperationalStatus('operational')).toBe(true);
    expect(isOperationalStatus('NOT OPERATIONAL')).toBe(false);
  });
});
