import { describe, expect, it } from 'vitest';

import {
  normaliseRadioInfoLine,
  UV5RMINI_FIRMWARE_NOT_SUPPORTED,
  UV5RMINI_FIRMWARE_OPTIONS,
  UV5RMINI_HARDWARE_OPTIONS,
  UV5RMINI_RADIO_INFO_REFUSAL,
  UV5RMINI_RADIO_INFO_WARNING,
  UV5RMINI_RADIO_LAYOUT_QUESTION,
  uv5rMiniLayoutFromRadioInfo,
} from './radioInfo.ts';

const ask = (firmware: string, hardware: string) =>
  uv5rMiniLayoutFromRadioInfo({ firmware, hardware });
const L1 = { kind: 'layout', layout: 'L1' } as const;
const L2 = { kind: 'layout', layout: 'L2' } as const;
const REFUSED = { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL } as const;
const NOT_SUPPORTED = { kind: 'refused', message: UV5RMINI_FIRMWARE_NOT_SUPPORTED } as const;

describe('uv5rMiniLayoutFromRadioInfo', () => {
  it('offers dropdowns of the supported values: Firmware V0.04, V0.27, Other; Hardware V1.7, Other', () => {
    expect(UV5RMINI_FIRMWARE_OPTIONS).toEqual(['V0.04', 'V0.27', 'Other']);
    expect(UV5RMINI_HARDWARE_OPTIONS).toEqual(['V1.7', 'Other']);
    expect(UV5RMINI_RADIO_LAYOUT_QUESTION.firmwareOptions).toBe(UV5RMINI_FIRMWARE_OPTIONS);
    expect(UV5RMINI_RADIO_LAYOUT_QUESTION.hardwareOptions).toBe(UV5RMINI_HARDWARE_OPTIONS);
  });

  it('maps Firmware V0.04 to L1 and V0.27 to L2', () => {
    expect(ask('V0.04', 'V1.7')).toEqual(L1);
    expect(ask('V0.27', 'V1.7')).toEqual(L2);
  });

  it('refuses Other, or any unlisted Firmware line, as not supported', () => {
    for (const fw of ['Other', 'V0.05', 'V0.30', 'V1.00', 'mm9pdy-L1-1.0.0']) {
      expect(ask(fw, 'V1.7')).toEqual(NOT_SUPPORTED);
    }
    expect(ask('Other', 'Other')).toEqual(REFUSED);
  });

  it('warns accurately: a wrong pick is refused with nothing installed, but FM presets and volume may reset', () => {
    expect(UV5RMINI_RADIO_LAYOUT_QUESTION.warning).toBe(UV5RMINI_RADIO_INFO_WARNING);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/exactly what the radio's Radio Info screen shows/);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/refuses the file and nothing is installed/);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/FM presets and volume may be reset/);
    expect(UV5RMINI_RADIO_INFO_WARNING).not.toMatch(/brick/i);
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
      ['V0.27', 'Other'],
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
      [
        'firmwareLabel',
        'firmwareOptions',
        'hardwareLabel',
        'hardwareOptions',
        'intro',
        'report',
        'resolve',
        'steps',
        'warning',
      ].sort(),
    );
    const text = [q.intro, ...q.steps, q.report!.intro, ...q.report!.steps].join(' ');
    expect(text).not.toMatch(/hardware layout/i);
    expect(text).toMatch(/flash layouts/);
  });

  it('reads the radio report first: a report decides, no report means the question', () => {
    const resolve = UV5RMINI_RADIO_LAYOUT_QUESTION.report!.resolve;
    expect(resolve(new Uint8Array(64).fill(0xff))).toBeNull();
    const example = Uint8Array.from(
      '4d4d3952010000000040090000a0060000400900341200006d6d397064792d4c322d302e322e302d72632e31000000000000000000000000000000000000cf95'
        .match(/../g)!
        .map((x) => parseInt(x, 16)),
    );
    expect(resolve(example)).toMatchObject({
      kind: 'layout',
      layout: 'L2',
      build: 'mm9pdy-L2-0.2.0-rc.1',
    });
  });
});
