import { afterEach, describe, expect, it } from 'vitest';
import {
  MM9PDY_TG_NEXT_FUNCTION,
  MM9PDY_TG_PREVIOUS_FUNCTION,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import {
  clearAllOverrides,
  overridesForWrite,
  setOverride,
} from '../../../../state/atD890RadioSettingsSession.ts';
import type { ReviewContext } from '../reviewSections.tsx';
import { createAtD890ReviewController, type AtD890ReviewInit } from './atD890ReviewController.ts';
import { atD890ReviewPauseReasons } from './atD890ReviewPause.ts';

const BUILD = 'review-pause-d890';

/** A codeplug Write to the radio the settings were read from, with nothing to warn about. */
function clean(over: Partial<AtD890ReviewInit> = {}): AtD890ReviewInit {
  return {
    buildId: BUILD,
    serial: 'SN0001',
    masterIdName: 'X',
    range: { caption: 'x', summary: 'x' } as AtD890ReviewInit['range'],
    receiveOnly: [],
    snapshot: { main: new Uint8Array(0x200), ext: new Uint8Array(0x60) },
    target: 'stock',
    decoded: {},
    languageLock: 0,
    getOverrides: () => overridesForWrite(BUILD),
    onClearLanguage: () => undefined,
    initialSettingsTicked: false,
    sameRadio: true,
    applyToEveryRadio: false,
    settingsOnly: false,
    fullReadHeld: true,
    readRestSeconds: null,
    initialChoice: 'apply',
    initialBackup: { status: 'none' },
    onSaveBackup: () => undefined,
    onReviewSettings: () => undefined,
    onUseStepKeys: () => undefined,
    ...over,
  };
}

function reasons(init: AtD890ReviewInit) {
  const atD890 = createAtD890ReviewController(init);
  return atD890ReviewPauseReasons({ atD890 } as unknown as ReviewContext);
}

afterEach(() => clearAllOverrides(BUILD));

describe('AT-D890 Review pause reasons (#1638)', () => {
  it('none for a clean codeplug Write, even with no backup this session', () => {
    expect(reasons(clean())).toEqual([]);
  });

  it('none without the D890 context (keps alone)', () => {
    expect(atD890ReviewPauseReasons({} as ReviewContext)).toEqual([]);
  });

  it('none for settings applied to the radio they were read from', () => {
    setOverride(BUILD, 'keyTone', true);
    expect(reasons(clean({ initialSettingsTicked: true, settingsOnly: true }))).toEqual([]);
  });

  it('receive-only channels', () => {
    const receiveOnly = [{ slotIndex: 2, name: 'Ch2', txMhz: 446 }];
    expect(reasons(clean({ receiveOnly }))).toEqual(['receive-only-channels']);
  });

  it('Master Id on, except for settings alone', () => {
    expect(reasons(clean({ masterIdSelected: true }))).toEqual(['master-id-on']);
    setOverride(BUILD, 'keyTone', true);
    expect(
      reasons(clean({ masterIdSelected: true, initialSettingsTicked: true, settingsOnly: true })),
    ).toEqual([]);
  });

  it('the MM9PDY step-key nudge, until the user chooses for the keys', () => {
    const mm9pdy = clean({ target: 'mm9pdy' });
    expect(reasons(mm9pdy)).toEqual(['step-keys-nudge']);
    const stepKeys = clean({
      target: 'mm9pdy',
      decoded: {
        keyShortP1: { value: MM9PDY_TG_NEXT_FUNCTION, raw: [] },
        keyShortP2: { value: MM9PDY_TG_PREVIOUS_FUNCTION, raw: [] },
      },
    });
    expect(reasons(stepKeys)).toEqual([]);
    setOverride(BUILD, 'keyShortP1', 3);
    expect(reasons(mm9pdy)).toEqual([]);
  });

  it('a language the region forbids, and Write would send nothing', () => {
    setOverride(BUILD, 'language', 2);
    expect(
      reasons(clean({ languageLock: 1, initialSettingsTicked: true, settingsOnly: true })),
    ).toEqual(['nothing-to-write', 'settings-blocked']);
  });

  it('the repeater-mode caution', () => {
    setOverride(BUILD, 'repeaterMode', true);
    expect(reasons(clean({ initialSettingsTicked: true }))).toEqual(['repeater-mode-caution']);
  });

  it("another radio: the Apply / Keep choice, unless 'don't ask again' is set", () => {
    setOverride(BUILD, 'keyTone', true);
    const other = { initialSettingsTicked: true, sameRadio: false, initialChoice: 'keep' } as const;
    expect(reasons(clean(other))).toEqual(['settings-choice']);
    expect(reasons(clean({ ...other, applyToEveryRadio: true, initialChoice: 'apply' }))).toEqual(
      [],
    );
  });

  it('settings alone with Keep sends nothing', () => {
    setOverride(BUILD, 'keyTone', true);
    expect(
      reasons(
        clean({
          initialSettingsTicked: true,
          settingsOnly: true,
          sameRadio: false,
          initialChoice: 'keep',
        }),
      ),
    ).toEqual(['nothing-to-write', 'settings-choice']);
  });
});
