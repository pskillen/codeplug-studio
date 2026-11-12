import { describe, expect, it } from 'vitest';

import {
  normaliseRadioInfoLine,
  UV5RMINI_RADIO_INFO_REFUSAL,
  uv5rMiniLayoutFromRadioInfo,
} from './radioInfo.ts';

const ask = (firmware: string, hardware: string, override = false) =>
  uv5rMiniLayoutFromRadioInfo({ firmware, hardware, override });

describe('uv5rMiniLayoutFromRadioInfo', () => {
  it('maps the two proven pairs', () => {
    expect(ask('V0.04', 'V1.7')).toEqual({ kind: 'layout', layout: 'L1' });
    expect(ask('V0.27', 'V1.7')).toEqual({ kind: 'layout', layout: 'L2' });
  });

  it('reads the lines loosely: case, spaces and a missing V', () => {
    expect(ask(' v0.27 ', '1.7')).toEqual({ kind: 'layout', layout: 'L2' });
    expect(normaliseRadioInfoLine('v 0.04')).toBe('V0.04');
  });

  it('refuses any other pair', () => {
    for (const [fw, hw] of [
      ['V0.05', 'V1.7'],
      ['V0.27', 'V1.8'],
      ['V0.04', 'V1.6'],
      ['mm9pdy-L1-1.0.0', 'V1.7'],
    ] as const) {
      expect(ask(fw, hw)).toEqual({ kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL });
      expect(ask(fw, hw, true)).toEqual({ kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL });
    }
    expect(UV5RMINI_RADIO_INFO_REFUSAL).toBe(
      "Studio doesn't recognise this radio's Radio Info; nothing was sent.",
    );
  });

  it('waits for both lines', () => {
    expect(ask('', 'V1.7')).toEqual({ kind: 'incomplete' });
    expect(ask('V0.27', ' ')).toEqual({ kind: 'incomplete' });
  });

  it('the override makes a V0.27 radio layout 1', () => {
    expect(ask('V0.27', 'V1.7', true)).toEqual({ kind: 'layout', layout: 'L1' });
    expect(ask('V0.04', 'V1.7', true)).toEqual({ kind: 'layout', layout: 'L1' });
  });
});
