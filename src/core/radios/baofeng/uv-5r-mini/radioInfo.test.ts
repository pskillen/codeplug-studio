import { describe, expect, it } from 'vitest';

import { fromHex, RADIO_REPORT_EXAMPLE_HEX } from './__fixtures__/radioReportFrame.ts';
import {
  normaliseRadioInfoLine,
  UV5RMINI_FIRMWARE_NOT_SUPPORTED,
  UV5RMINI_FIRMWARE_OPTIONS,
  UV5RMINI_HARDWARE_OPTIONS,
  UV5RMINI_NO_BUILD_FOR_RADIO,
  UV5RMINI_RADIO_INFO_REFUSAL,
  UV5RMINI_RADIO_INFO_WARNING,
  UV5RMINI_RADIO_LAYOUT_QUESTION,
  UV5RMINI_SUFFIX_NOT_SUPPORTED,
  UV5RMINI_SUFFIX_OPTIONS,
  uv5rMiniLayoutFromRadioInfo,
  uv5rMiniVariantOfBase,
} from './radioInfo.ts';

const ask = (firmware: string, suffix: string, hardware: string) =>
  uv5rMiniLayoutFromRadioInfo({ firmware, suffix, hardware });
const NRFB_V004 = { kind: 'layout', layout: 'L1', codeBase: 'nrfb-v0.04' } as const;
const NRF_V027 = { kind: 'layout', layout: 'L2', codeBase: 'nrf-v0.27' } as const;
const REFUSED = { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL } as const;
const NOT_SUPPORTED = { kind: 'refused', message: UV5RMINI_FIRMWARE_NOT_SUPPORTED } as const;

describe('uv5rMiniLayoutFromRadioInfo', () => {
  it('offers dropdowns of the supported values: Firmware, suffix and Hardware', () => {
    expect(UV5RMINI_FIRMWARE_OPTIONS).toEqual(['V0.04', 'V0.27', 'Other']);
    expect(UV5RMINI_SUFFIX_OPTIONS).toEqual(['NRF', 'NRFB', 'Other']);
    expect(UV5RMINI_HARDWARE_OPTIONS).toEqual(['V1.7', 'Other']);
    const q = UV5RMINI_RADIO_LAYOUT_QUESTION;
    expect(q.firmwareOptions).toBe(UV5RMINI_FIRMWARE_OPTIONS);
    expect(q.suffixOptions).toBe(UV5RMINI_SUFFIX_OPTIONS);
    expect(q.hardwareOptions).toBe(UV5RMINI_HARDWARE_OPTIONS);
  });

  it('says where each line is: Firmware and Hardware on Radio Info, the suffix on the hold-8 start-up screen', () => {
    const q = UV5RMINI_RADIO_LAYOUT_QUESTION;
    expect(q.firmwareHelp).toBe('From Radio Info (MENU → Radio Info).');
    expect(q.hardwareHelp).toBe('From Radio Info (MENU → Radio Info).');
    expect(q.suffixLabel).toBe('Suffix');
    expect(q.suffixHelp).toBe(
      'Not on Radio Info. Switch the radio off, then hold 8 while switching it on: for about a second it shows 5RMINI NRF or 5RMINI NRFB, then boots normally. Repeat it, or film the screen with your phone, if you miss it.',
    );
  });

  it('maps a whole base: NRFB V0.04 is nrfb-v0.04 (L1), NRF V0.27 is nrf-v0.27 (L2)', () => {
    expect(ask('V0.04', 'NRFB', 'V1.7')).toEqual(NRFB_V004);
    expect(ask('V0.27', 'NRF', 'V1.7')).toEqual(NRF_V027);
  });

  it('refuses a combination with no base as having no build yet, never the nearest one', () => {
    expect(ask('V0.04', 'NRF', 'V1.7')).toEqual({
      kind: 'refused',
      message: UV5RMINI_NO_BUILD_FOR_RADIO('NRF', 'V0.04'),
    });
    expect(ask('V0.27', 'NRFB', 'V1.7')).toEqual({
      kind: 'refused',
      message: UV5RMINI_NO_BUILD_FOR_RADIO('NRFB', 'V0.27'),
    });
    expect(UV5RMINI_NO_BUILD_FOR_RADIO('NRF', 'V0.04')).toBe(
      'There is no MM9PDY build for this radio (NRF V0.04) yet; nothing was sent.',
    );
  });

  it('refuses Other, or any unlisted line, as not supported', () => {
    for (const fw of ['Other', 'V0.05', 'V0.30', 'V1.00', 'mm9pdy-L1-1.0.0']) {
      expect(ask(fw, 'NRF', 'V1.7')).toEqual(NOT_SUPPORTED);
    }
    for (const sfx of ['Other', 'NRFC']) {
      expect(ask('V0.27', sfx, 'V1.7')).toEqual({
        kind: 'refused',
        message: UV5RMINI_SUFFIX_NOT_SUPPORTED,
      });
    }
    expect(ask('Other', 'Other', 'Other')).toEqual(REFUSED);
  });

  it('warns accurately: a wrong Firmware or suffix pick is refused, a wrong Hardware pick is not caught', () => {
    expect(UV5RMINI_RADIO_LAYOUT_QUESTION.warning).toBe(UV5RMINI_RADIO_INFO_WARNING);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/exactly what the radio shows/);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(
      /Firmware or suffix you pick is wrong, Studio or the radio refuses the file and nothing is installed/,
    );
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/FM presets and volume may be reset/);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/Hardware line is wrong, nothing stops the update/);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/doesn't know yet may not be caught/);
    // The claim is scoped: never that any wrong pick is refused.
    expect(UV5RMINI_RADIO_INFO_WARNING).not.toMatch(/If what you pick doesn't match/);
    expect(UV5RMINI_RADIO_INFO_WARNING).not.toMatch(/brick/i);
  });

  it('reads the lines loosely: case, spaces and a missing V', () => {
    expect(ask(' v0.04 ', 'nrfb ', '1.7')).toEqual(NRFB_V004);
    expect(ask('0.27', 'Nrf', 'v 1.7')).toEqual(NRF_V027);
    expect(normaliseRadioInfoLine('v 0.04')).toBe('V0.04');
  });

  it('refuses a Hardware line not proven, whatever the other lines', () => {
    for (const [fw, hw] of [
      ['V0.04', 'V1.6'],
      ['V0.27', 'V1.8'],
      ['V0.27', 'V2.0'],
      ['V0.04', 'V0.04'],
      ['V0.27', 'Other'],
    ] as const) {
      expect(ask(fw, 'NRF', hw)).toEqual(REFUSED);
    }
    expect(UV5RMINI_RADIO_INFO_REFUSAL).toBe(
      "Studio hasn't been proven on this radio's Hardware version; nothing was sent.",
    );
  });

  it('waits for all three lines', () => {
    expect(ask('', 'NRF', 'V1.7')).toEqual({ kind: 'incomplete' });
    expect(ask('V0.27', '', 'V1.7')).toEqual({ kind: 'incomplete' });
    expect(ask('V0.27', 'NRF', ' ')).toEqual({ kind: 'incomplete' });
    expect(uv5rMiniLayoutFromRadioInfo({ firmware: 'V0.27', hardware: 'V1.7' })).toEqual({
      kind: 'incomplete',
    });
  });

  it('names the variant of a base by its suffix', () => {
    expect(uv5rMiniVariantOfBase('nrf-v0.27')).toBe('nrf');
    expect(uv5rMiniVariantOfBase('nrfb-v0.04')).toBe('nrfb');
    expect(uv5rMiniVariantOfBase('synthetic')).toBeUndefined();
  });

  it('asks only the three lines and never calls L1/L2 a hardware layout', () => {
    const q = UV5RMINI_RADIO_LAYOUT_QUESTION;
    expect(Object.keys(q).sort()).toEqual(
      [
        'firmwareHelp',
        'firmwareLabel',
        'firmwareOptions',
        'hardwareHelp',
        'hardwareLabel',
        'hardwareOptions',
        'intro',
        'report',
        'resolve',
        'steps',
        'suffixHelp',
        'suffixLabel',
        'suffixOptions',
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
    const example = fromHex(RADIO_REPORT_EXAMPLE_HEX);
    expect(resolve(example)).toMatchObject({
      kind: 'layout',
      layout: 'L2',
      build: 'mm9pdy-L2-0.2.0-rc.1',
    });
  });
});
