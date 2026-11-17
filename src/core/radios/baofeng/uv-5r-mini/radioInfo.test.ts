import { describe, expect, it } from 'vitest';

import { fromHex, RADIO_REPORT_EXAMPLE_HEX } from './__fixtures__/radioReportFrame.ts';
import {
  normaliseRadioInfoLine,
  UV5RMINI_HARDWARE_OPTIONS,
  UV5RMINI_RADIO_INFO_REFUSAL,
  UV5RMINI_RADIO_INFO_WARNING,
  UV5RMINI_RADIO_LAYOUT_QUESTION,
  UV5RMINI_SUFFIX_NOT_SUPPORTED,
  UV5RMINI_SUFFIX_OPTIONS,
  uv5rMiniLayoutFromRadioInfo,
  uv5rMiniVariantOfBase,
} from './radioInfo.ts';

const ask = (suffix: string, hardware: string, firmware = '') =>
  uv5rMiniLayoutFromRadioInfo({ firmware, suffix, hardware });
const FIRST = { kind: 'layout', layout: 'L1', codeBase: 'nrfb-v0.04' } as const;
const REFUSED = { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL } as const;

describe('uv5rMiniLayoutFromRadioInfo', () => {
  it('offers dropdowns of the supported values: suffix and Hardware, and no Firmware line', () => {
    expect(UV5RMINI_SUFFIX_OPTIONS).toEqual(['NRF', 'NRFB', 'Other']);
    expect(UV5RMINI_HARDWARE_OPTIONS).toEqual(['V1.7', 'Other']);
    const q = UV5RMINI_RADIO_LAYOUT_QUESTION;
    expect(q.omitFirmwareLine).toBe(true);
    expect(q.firmwareOptions).toBeUndefined();
    expect(q.suffixOptions).toBe(UV5RMINI_SUFFIX_OPTIONS);
    expect(q.hardwareOptions).toBe(UV5RMINI_HARDWARE_OPTIONS);
  });

  it('says where each line is: Hardware on Radio Info, the suffix on the hold-8 start-up screen', () => {
    const q = UV5RMINI_RADIO_LAYOUT_QUESTION;
    expect(q.firmwareHelp).toBeUndefined();
    expect(q.hardwareHelp).toBe('From Radio Info (MENU → Radio Info).');
    expect(q.suffixLabel).toBe('Suffix');
    expect(q.suffixHelp).toBe(
      'Not on Radio Info. Switch the radio off, then hold 8 while switching it on: for about a second it shows 5RMINI NRF or 5RMINI NRFB, then boots normally. Repeat it, or film the screen with your phone, if you miss it.',
    );
  });

  it('sends the L1 file first for either known suffix, whatever the Firmware line', () => {
    expect(ask('NRFB', 'V1.7')).toEqual(FIRST);
    expect(ask('NRF', 'V1.7')).toEqual(FIRST);
    expect(ask('NRF', 'V1.7', 'V0.27')).toEqual(FIRST);
    expect(ask('NRFB', 'V1.7', 'V0.04')).toEqual(FIRST);
    expect(ask('NRF', 'V1.7', 'Other')).toEqual(FIRST);
  });

  it('refuses Other, or any unlisted suffix, as not supported', () => {
    for (const sfx of ['Other', 'NRFC']) {
      expect(ask(sfx, 'V1.7')).toEqual({
        kind: 'refused',
        message: UV5RMINI_SUFFIX_NOT_SUPPORTED,
      });
    }
    expect(ask('Other', 'Other')).toEqual(REFUSED);
  });

  it('warns without a settings warning: an unknown suffix or Hardware line stops the update', () => {
    expect(UV5RMINI_RADIO_LAYOUT_QUESTION.warning).toBe(UV5RMINI_RADIO_INFO_WARNING);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/suffix and Hardware line the radio shows/);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/unknown suffix or Hardware line stops the update/);
    expect(UV5RMINI_RADIO_INFO_WARNING).toMatch(/sends one file first/);
    expect(UV5RMINI_RADIO_INFO_WARNING).not.toMatch(/FM presets|volume|settings/);
    expect(UV5RMINI_RADIO_INFO_WARNING).not.toMatch(/brick/i);
  });

  it('reads the lines loosely: case, spaces and a missing V', () => {
    expect(ask('nrfb ', '1.7')).toEqual(FIRST);
    expect(ask('Nrf', 'v 1.7')).toEqual(FIRST);
    expect(normaliseRadioInfoLine('v 0.04')).toBe('V0.04');
  });

  it('refuses a Hardware line not proven, whatever the suffix', () => {
    for (const hw of ['V1.6', 'V1.8', 'V2.0', 'V0.04', 'Other'] as const) {
      expect(ask('NRF', hw)).toEqual(REFUSED);
    }
    expect(UV5RMINI_RADIO_INFO_REFUSAL).toBe(
      "Studio hasn't been proven on this radio's Hardware version; nothing was sent.",
    );
  });

  it('waits for the suffix and the Hardware line, and does not wait for a Firmware line', () => {
    expect(ask('', 'V1.7')).toEqual({ kind: 'incomplete' });
    expect(ask('NRF', ' ')).toEqual({ kind: 'incomplete' });
    expect(uv5rMiniLayoutFromRadioInfo({ firmware: '', suffix: 'NRF', hardware: 'V1.7' })).toEqual(
      FIRST,
    );
    expect(uv5rMiniLayoutFromRadioInfo({ firmware: 'V0.27', hardware: 'V1.7' })).toEqual({
      kind: 'incomplete',
    });
  });

  it('names the variant of a base by its suffix', () => {
    expect(uv5rMiniVariantOfBase('nrf-v0.27')).toBe('nrf');
    expect(uv5rMiniVariantOfBase('nrfb-v0.04')).toBe('nrfb');
    expect(uv5rMiniVariantOfBase('synthetic')).toBeUndefined();
  });

  it('asks the suffix and Hardware line, not the Firmware line, and never calls L1/L2 a hardware layout', () => {
    const q = UV5RMINI_RADIO_LAYOUT_QUESTION;
    expect(Object.keys(q).sort()).toEqual(
      [
        'firmwareLabel',
        'hardwareHelp',
        'hardwareLabel',
        'hardwareOptions',
        'intro',
        'omitFirmwareLine',
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
    // The flash layout is an internal detail: the user is told about their radio's firmware.
    expect(text).not.toMatch(/layout/i);
    expect(text).toMatch(/your radio's firmware/);
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
