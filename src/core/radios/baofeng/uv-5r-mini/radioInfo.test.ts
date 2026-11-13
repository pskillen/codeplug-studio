import { describe, expect, it } from 'vitest';

import {
  normaliseRadioInfoLine,
  UV5RMINI_RADIO_INFO_REFUSAL,
  UV5RMINI_RADIO_LAYOUT_QUESTION,
  uv5rMiniLayoutFromRadioInfo,
} from './radioInfo.ts';

const ask = (firmware: string, hardware: string) =>
  uv5rMiniLayoutFromRadioInfo({ firmware, hardware });
const L1 = { kind: 'layout', layout: 'L1' } as const;
const L2 = { kind: 'layout', layout: 'L2' } as const;
const REFUSED = { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL } as const;

describe('uv5rMiniLayoutFromRadioInfo', () => {
  it('maps Firmware V0.04 to L1 and V0.27 to L2', () => {
    expect(ask('V0.04', 'V1.7')).toEqual(L1);
    expect(ask('V0.27', 'V1.7')).toEqual(L2);
  });

  it('maps any other Firmware line to L2', () => {
    for (const fw of ['V0.05', 'V0.30', 'V1.00', 'mm9pdy-L1-1.0.0']) {
      expect(ask(fw, 'V1.7')).toEqual(L2);
    }
  });

  it('reads the lines loosely: case, spaces and a missing V', () => {
    expect(ask(' v0.04 ', '1.7')).toEqual(L1);
    expect(ask('0.27', 'v 1.7')).toEqual(L2);
    expect(normaliseRadioInfoLine('v 0.04')).toBe('V0.04');
  });

  it('refuses a Hardware line not proven, whatever the Firmware line', () => {
    for (const [fw, hw] of [
      ['V0.04', 'V1.6'],
      ['V0.27', 'V1.8'],
      ['V0.27', 'V2.0'],
      ['V0.04', 'V0.04'],
    ] as const) {
      expect(ask(fw, hw)).toEqual(REFUSED);
    }
    expect(UV5RMINI_RADIO_INFO_REFUSAL).toBe(
      "Studio hasn't been proven on this radio's Hardware version; nothing was sent.",
    );
  });

  it('waits for both lines', () => {
    expect(ask('', 'V1.7')).toEqual({ kind: 'incomplete' });
    expect(ask('V0.27', ' ')).toEqual({ kind: 'incomplete' });
  });

  it('asks only the two lines and never calls L1/L2 a hardware layout', () => {
    const q = UV5RMINI_RADIO_LAYOUT_QUESTION;
    expect(Object.keys(q).sort()).toEqual(
      ['firmwareLabel', 'hardwareLabel', 'intro', 'resolve', 'steps'].sort(),
    );
    const text = [q.intro, ...q.steps].join(' ');
    expect(text).not.toMatch(/hardware layout/i);
    expect(text).toMatch(/flash layouts/);
  });
});
