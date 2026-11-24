import { describe, expect, it } from 'vitest';
import { atD890SettingsPart } from './atD890SettingsPart.ts';
import {
  createAtD890ReviewController,
  type AtD890ReviewController,
  type AtD890ReviewInit,
} from './atD890ReviewController.ts';
import { setOverride } from '../../../../state/atD890RadioSettingsSession.ts';

function init(over: Partial<AtD890ReviewInit> = {}): AtD890ReviewInit {
  return {
    buildId: 'b',
    serial: 'SN0001',
    masterIdName: 'X',
    range: { caption: 'x', summary: 'x' } as AtD890ReviewInit['range'],
    receiveOnly: [],
    snapshot: { main: new Uint8Array(0x200), ext: new Uint8Array(0x60) },
    target: 'stock',
    decoded: {},
    languageLock: 0,
    getOverrides: () => [],
    onClearLanguage: () => undefined,
    initialSettingsTicked: true,
    sameRadio: true,
    applyToEveryRadio: false,
    settingsOnly: true,
    fullReadHeld: false,
    readRestSeconds: null,
    initialChoice: 'apply',
    initialBackup: { status: 'none' },
    onSaveBackup: () => undefined,
    onReviewSettings: () => undefined,
    onUseStepKeys: () => undefined,
    ...over,
  };
}

describe('atD890SettingsPart', () => {
  it('matches both D890 profiles', () => {
    expect(atD890SettingsPart.matches('radio-io-at-d890uv')).toBe(true);
    expect(atD890SettingsPart.matches('radio-io-at-d890uv-mm9pdy')).toBe(true);
    expect(atD890SettingsPart.matches('radio-io-rt95')).toBe(false);
  });

  function stubController(choice: 'apply' | 'keep', overrideCount: number): AtD890ReviewController {
    const ctrl = createAtD890ReviewController(
      init({
        initialChoice: choice,
        getOverrides: () => (overrideCount > 0 ? [{ fieldId: 'x', value: 1 as const }] : []),
      }),
    );
    ctrl.setChoice(choice);
    return ctrl;
  }

  it('pause result is keep without overrides', () => {
    const controller = stubController('apply', 0);
    expect(atD890SettingsPart.pauseResult(controller, 'b1', false)).toBe('keep');
  });

  it('pause result applies the session overrides when Apply is chosen', () => {
    const buildId = 'atd890-pause-test';
    setOverride(buildId, 'stepKey1', 1);
    const controller = stubController('apply', 1);
    const result = atD890SettingsPart.pauseResult(controller, buildId, true);
    expect(result).toMatchObject({ decision: 'apply' });
    expect(result).toEqual({
      decision: 'apply',
      overrides: expect.arrayContaining([expect.objectContaining({ fieldId: 'stepKey1' })]),
    });
  });
});
