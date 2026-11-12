import { describe, expect, it } from 'vitest';

import {
  normaliseRadioInfoLine,
  parseUv5rMiniBuildName,
  UV5RMINI_RADIO_INFO_REFUSAL,
  uv5rMiniLayoutFromRadioInfo,
} from './radioInfo.ts';

const ask = (firmware: string, hardware: string, override = false, build = '') =>
  uv5rMiniLayoutFromRadioInfo({ firmware, hardware, build, override });
const L1 = { kind: 'layout', layout: 'L1' } as const;
const L2 = { kind: 'layout', layout: 'L2' } as const;
const REFUSED = { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL } as const;

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

describe('parseUv5rMiniBuildName', () => {
  it('reads the layout from an L1-tagged name, every form', () => {
    for (const name of [
      'mm9pdy-L1-1.0.0',
      'mm9pdy-L1-1.0.0-rc.1',
      'mm9pdy-L1-pr141-g038b',
      'mm9pdy-L1-pr9-g1c0a9d',
      'mm9pdy-L1-g1c0a9df',
      'mm9pdy-L1-g1c0a-dirty',
    ]) {
      expect(parseUv5rMiniBuildName(name)).toEqual({ layout: 'L1', tagged: true });
    }
  });

  it('reads the layout from an L2-tagged name, every form', () => {
    for (const name of [
      'mm9pdy-L2-1.0.0',
      'mm9pdy-L2-0.2.0-rc.3',
      'mm9pdy-L2-pr140-g1c0a',
      'mm9pdy-L2-pr99-g1c0a9',
      'mm9pdy-L2-g1c0a9df',
      'mm9pdy-L2-g9f3e-dirty',
    ]) {
      expect(parseUv5rMiniBuildName(name)).toEqual({ layout: 'L2', tagged: true });
    }
  });

  it('maps each untagged form from before the layout tag to L1', () => {
    for (const name of [
      'mm9pdy-0.1.0-rc.1', // release / prerelease (radio 1's rc.1)
      'mm9pdy-1.0.0',
      'mm9pdy-pr125-g1c0a9df', // PR build with its hash (radio 1's W1)
      'mm9pdy-pr12', // PR build, the first form, no hash
      'mm9pdy-g1c0a9df', // ad hoc
      'mm9pdy-g1c0a9df-dirty',
    ]) {
      expect(parseUv5rMiniBuildName(name)).toEqual({ layout: 'L1', tagged: false });
    }
  });

  it('drops only surrounding spaces', () => {
    expect(parseUv5rMiniBuildName('  mm9pdy-L2-1.0.0 ')).toEqual({ layout: 'L2', tagged: true });
  });

  it('refuses anything outside the grammar, loose prefixes included', () => {
    for (const name of [
      'mm9pdy', // unstamped: emulator only, says nothing about the layout
      'mm9pdy-',
      'mm9pdy-L3-1.0.0',
      'mm9pdy-l1-1.0.0',
      'MM9PDY-L1-1.0.0',
      'mm9pdy-L1',
      'mm9pdy-L1-',
      'mm9pdy-L1-1.0',
      'mm9pdy-L1-1.0.0-beta',
      'mm9pdy-L1-pr141', // a tagged PR build always carries its hash
      'mm9pdy-L1-pr0-g1c0a',
      'mm9pdy-L1-pr14-g1c0', // 3 hash digits
      'mm9pdy-L1-g1C0A9DF',
      'mm9pdy-L1-g1c0a9df0', // 8 hash digits
      'mm9pdy-L1-g1c0a9df-dirty', // 24 characters: longer than the screen
      'mm9pdy-L1-1.0.0x',
      'mm9pdy-L1-1.0.0 extra',
      'mm9pdy-g1c0a', // untagged ad hoc always kept 7 digits
      'mm9pdy-pr12-g1c',
      'xmm9pdy-L1-1.0.0',
      'mm9pdy-L1-1.0.0-rc.1.2',
      'V0.04',
    ]) {
      expect(parseUv5rMiniBuildName(name)).toBeNull();
    }
  });
});

describe('uv5rMiniLayoutFromRadioInfo with a build name', () => {
  it('takes the layout from the name', () => {
    expect(ask('V0.04', 'V1.7', false, 'mm9pdy-L1-1.0.0')).toEqual(L1);
    expect(ask('V0.27', 'V1.7', false, 'mm9pdy-L2-1.0.0')).toEqual(L2);
    // An L1 radio moved to V0.27: the name says layout 1, no override needed.
    expect(ask('V0.27', 'V1.7', false, 'mm9pdy-L1-pr141-g038b')).toEqual(L1);
    expect(ask('V0.27', 'V1.7', true, 'mm9pdy-L1-1.0.0')).toEqual(L1);
  });

  it('maps radio 1 untagged builds to L1', () => {
    expect(ask('V0.04', 'V1.7', false, 'mm9pdy-0.1.0-rc.1')).toEqual(L1);
    expect(ask('V0.04', 'V1.7', false, 'mm9pdy-pr125-g1c0a9df')).toEqual(L1);
  });

  it('refuses a name outside the grammar, even on a proven pair', () => {
    expect(ask('V0.04', 'V1.7', false, 'mm9pdy')).toEqual(REFUSED);
    expect(ask('V0.27', 'V1.7', false, 'mm9pdy-L3-1.0.0')).toEqual(REFUSED);
    expect(ask('V0.27', 'V1.7', true, 'hello')).toEqual(REFUSED);
  });

  it('refuses answers that contradict each other', () => {
    // An L2 build never runs on V0.04.
    expect(ask('V0.04', 'V1.7', false, 'mm9pdy-L2-1.0.0')).toEqual(REFUSED);
    // The override says layout 1, the name says layout 2.
    expect(ask('V0.27', 'V1.7', true, 'mm9pdy-L2-1.0.0')).toEqual(REFUSED);
    // Untagged builds only ever ran on V0.04.
    expect(ask('V0.27', 'V1.7', false, 'mm9pdy-0.1.0-rc.1')).toEqual(REFUSED);
  });

  it('still needs a proven pair', () => {
    expect(ask('V0.05', 'V1.7', false, 'mm9pdy-L1-1.0.0')).toEqual(REFUSED);
    expect(ask('', 'V1.7', false, 'mm9pdy-L1-1.0.0')).toEqual({ kind: 'incomplete' });
  });

  it('ignores an empty or blank name', () => {
    expect(ask('V0.27', 'V1.7', false, '  ')).toEqual(L2);
  });
});
