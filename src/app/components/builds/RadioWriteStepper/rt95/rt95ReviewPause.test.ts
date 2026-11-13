import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAllOverrides,
  overridesForWrite,
  setOverride,
} from '../../../../state/rt95RadioSettingsSession.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import type { ReviewContext } from '../reviewSections.tsx';
import { createRt95ReviewController, type Rt95ReviewInit } from './rt95ReviewController.ts';
import { rt95ReviewPauseReasons } from './rt95ReviewPause.ts';

const BUILD = 'rt95-review-pause';

function controller(over: Partial<Rt95ReviewInit> = {}) {
  const image = buildSyntheticRt95Image();
  return createRt95ReviewController({
    buildId: BUILD,
    bandlimit: 1,
    snapshot: { image, bandlimit: 1 },
    target: 'stock',
    getOverrides: () => overridesForWrite(BUILD),
    initialSettingsTicked: true,
    sameRadio: true,
    settingsOnly: false,
    initialChoice: 'apply',
    initialBackup: { status: 'none' },
    onReviewSettings: () => undefined,
    ...over,
  });
}

function reasons(rt95: ReviewContext['rt95']) {
  return rt95ReviewPauseReasons({ rt95 } as ReviewContext);
}

afterEach(() => clearAllOverrides(BUILD));

describe('RT95 Review pause reasons (#1638)', () => {
  it('none for a plain codeplug Write (the channel-signalling note is a fact)', () => {
    expect(rt95ReviewPauseReasons({} as ReviewContext)).toEqual([]);
  });

  it('none for settings applied to the radio they were read from', () => {
    setOverride(BUILD, 'displayMode', 2);
    expect(reasons({ settings: controller() })).toEqual([]);
    expect(reasons({ settings: controller({ settingsOnly: true }) })).toEqual([]);
  });

  it('another band limit: the Apply / Keep choice', () => {
    setOverride(BUILD, 'displayMode', 2);
    expect(reasons({ settings: controller({ sameRadio: false, initialChoice: 'keep' }) })).toEqual([
      'settings-choice',
    ]);
  });

  it('settings alone with Keep sends nothing', () => {
    setOverride(BUILD, 'displayMode', 2);
    expect(
      reasons({
        settings: controller({ settingsOnly: true, sameRadio: false, initialChoice: 'keep' }),
      }),
    ).toEqual(['nothing-to-write', 'settings-choice']);
  });

  it('an advanced setting that changes, with no backup held: back up first', () => {
    setOverride(BUILD, 'remoteStun', '13579');
    expect(reasons({ settings: controller() })).toEqual(['advanced-settings-no-backup']);
    // A backup held, or Keep (nothing changes on this radio): no stop for the advice.
    expect(
      reasons({ settings: controller({ initialBackup: { status: 'saved', at: 1 } }) }),
    ).toEqual([]);
    expect(reasons({ settings: controller({ sameRadio: false, initialChoice: 'keep' }) })).toEqual([
      'settings-choice',
    ]);
  });

  it('MM9PDY zones with no zone key: the nudge', () => {
    expect(reasons({ modData: { zones: 3, descriptions: 0 } })).toEqual(['zone-key-nudge']);
    expect(
      reasons({ modData: { zones: 3, descriptions: 0, zoneKey: { group: 1, key: 2 } } }),
    ).toEqual([]);
    expect(reasons({ modData: { zones: 0, descriptions: 4 } })).toEqual([]);
  });
});
