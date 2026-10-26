import { describe, expect, it } from 'vitest';
import { createAtD890ReviewController, type AtD890ReviewInit } from './atD890ReviewController.ts';

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

describe('AT-D890 Review controller language guard', () => {
  const russian = [{ fieldId: 'language', value: 2 }];

  it('blocks Write while a forbidden language would be applied, naming the field', () => {
    const c = createAtD890ReviewController(init({ languageLock: 1, getOverrides: () => russian }));
    expect(c.blockReason()).toMatch(/only allows English.*Language/);
    expect(c.canWrite()).toBe(false);
  });

  it('unblocks on Keep its settings and blocks again on Apply', () => {
    const c = createAtD890ReviewController(
      init({
        languageLock: 2,
        getOverrides: () => [{ fieldId: 'language', value: 0 }],
        settingsOnly: false,
      }),
    );
    expect(c.canWrite()).toBe(false);
    c.setChoice('keep');
    expect(c.blockReason()).toBeUndefined();
    expect(c.canWrite()).toBe(true);
    c.setChoice('apply');
    expect(c.canWrite()).toBe(false);
  });

  it('unblocks when the override is cleared, and refresh tells listeners', () => {
    let overrides: { fieldId: string; value: number }[] = [...russian];
    const c = createAtD890ReviewController(
      init({ languageLock: 1, getOverrides: () => overrides }),
    );
    let calls = 0;
    c.subscribe(() => calls++);
    overrides = [];
    c.refresh();
    expect(calls).toBe(1);
    expect(c.canWrite()).toBe(true);
  });

  it('allows the language the lock keeps, and anything on a free radio', () => {
    const english = [{ fieldId: 'language', value: 0 }];
    expect(
      createAtD890ReviewController(
        init({ languageLock: 1, getOverrides: () => english }),
      ).canWrite(),
    ).toBe(true);
    expect(
      createAtD890ReviewController(
        init({ languageLock: 0, getOverrides: () => russian }),
      ).canWrite(),
    ).toBe(true);
  });

  it('does not block when Radio settings is not ticked', () => {
    const c = createAtD890ReviewController(
      init({ languageLock: 1, getOverrides: () => russian, initialSettingsTicked: false }),
    );
    expect(c.blockReason()).toBeUndefined();
  });
});
