import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AtD890RadioSettingsRead } from './atD890RadioSettingsSession.ts';

async function freshStore() {
  vi.resetModules();
  return import('./atD890RadioSettingsSession.ts');
}

function read(decoded: AtD890RadioSettingsRead['decoded']): AtD890RadioSettingsRead {
  return {
    serial: 'SN-TEST',
    masterIdName: 'Demo',
    readAt: 1,
    bandCode: 3,
    languageLock: 0,
    decoded,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AT-D890 radio settings session store', () => {
  it('starts empty in a fresh module instance', async () => {
    const a = await freshStore();
    a.setOverride('b1', 'keyTone', false);
    expect(a.getAtD890RadioSettingsSession('b1').overrides.size).toBe(1);
    const b = await freshStore();
    const s = b.getAtD890RadioSettingsSession('b1');
    expect(s.overrides.size).toBe(0);
    expect(s.read).toBeUndefined();
    expect(s.applyToEveryRadio).toBe(false);
  });

  it('sets, clears and lists overrides in field display order', async () => {
    const m = await freshStore();
    m.setOverride('b1', 'smsFormat', 2);
    m.setOverride('b1', 'keyTone', true);
    expect(m.overridesForWrite('b1')).toEqual([
      { fieldId: 'keyTone', value: true },
      { fieldId: 'smsFormat', value: 2 },
    ]);
    m.clearOverride('b1', 'keyTone');
    expect(m.overridesForWrite('b1')).toEqual([{ fieldId: 'smsFormat', value: 2 }]);
    m.clearAllOverrides('b1');
    expect(m.overridesForWrite('b1')).toEqual([]);
  });

  it('keeps overrides across setRead', async () => {
    const m = await freshStore();
    m.setOverride('b1', 'keyTone', false);
    m.setRead('b1', read({ keyTone: { value: true, raw: [1] } }));
    const s = m.getAtD890RadioSettingsSession('b1');
    expect(s.overrides.get('keyTone')).toBe(false);
    expect(s.read?.decoded.keyTone?.value).toBe(true);
  });

  it('copyAllFromRead only touches fields with a decoded value', async () => {
    const m = await freshStore();
    m.setOverride('b1', 'callAlert', 1);
    m.setOverride('b1', 'smsFormat', 2);
    m.setRead(
      'b1',
      read({
        keyTone: { value: true, raw: [1] },
        smsFormat: { value: undefined, raw: [9] },
        callDisplayMode: { value: undefined, raw: [2], label: 'Name based' },
        powerOnLine1: { value: '', raw: new Array(0x20).fill(0) },
        notAV1Field: { value: 5, raw: [5] },
      }),
    );
    m.copyAllFromRead('b1');
    expect(Object.fromEntries(m.getAtD890RadioSettingsSession('b1').overrides)).toEqual({
      callAlert: 1,
      smsFormat: 2,
      keyTone: true,
      powerOnLine1: '',
    });
  });

  it('copyAllFromRead does nothing without a read', async () => {
    const m = await freshStore();
    m.copyAllFromRead('b1');
    expect(m.getAtD890RadioSettingsSession('b1').overrides.size).toBe(0);
  });

  it('keeps builds independent', async () => {
    const m = await freshStore();
    m.setOverride('b1', 'keyTone', false);
    m.setApplyToEveryRadio('b2', true);
    expect(m.getAtD890RadioSettingsSession('b2').overrides.size).toBe(0);
    expect(m.getAtD890RadioSettingsSession('b1').applyToEveryRadio).toBe(false);
    expect(m.getAtD890RadioSettingsSession('b2').applyToEveryRadio).toBe(true);
  });

  it('notifies subscribers and the hook re-renders', async () => {
    const m = await freshStore();
    const { result } = renderHook(() => m.useAtD890RadioSettingsSession('b1'));
    expect(result.current.overrides.size).toBe(0);
    act(() => m.setOverride('b1', 'keyTone', true));
    expect(result.current.overrides.get('keyTone')).toBe(true);
  });

  it('never touches localStorage, sessionStorage or IndexedDB', async () => {
    const ls = vi.spyOn(Storage.prototype, 'setItem');
    const lg = vi.spyOn(Storage.prototype, 'getItem');
    const idb = vi.fn();
    vi.stubGlobal('indexedDB', new Proxy({}, { get: idb }));
    const m = await freshStore();
    m.setOverride('b1', 'keyTone', true);
    m.setRead('b1', read({ keyTone: { value: true, raw: [1] } }));
    m.copyAllFromRead('b1');
    m.clearAllOverrides('b1');
    m.setApplyToEveryRadio('b1', true);
    expect(ls).not.toHaveBeenCalled();
    expect(lg).not.toHaveBeenCalled();
    expect(idb).not.toHaveBeenCalled();
  });
});

describe('the Review helpers (PR 4c)', () => {
  it('preselects Apply for the radio the settings were read from, Keep for any other or none', async () => {
    const m = await freshStore();
    expect(m.defaultSettingsChoice(m.getAtD890RadioSettingsSession('b1'), 'SN-TEST')).toBe('keep');
    m.setRead('b1', read({}));
    const state = m.getAtD890RadioSettingsSession('b1');
    expect(m.defaultSettingsChoice(state, 'SN-TEST')).toBe('apply');
    expect(m.isSettingsReadRadio(state, 'SN-TEST')).toBe(true);
    expect(m.defaultSettingsChoice(state, 'SN-OTHER')).toBe('keep');
    expect(m.isSettingsReadRadio(state, 'SN-OTHER')).toBe(false);
  });

  it('never treats a blank serial as the same radio, even when the read radio was blank too', async () => {
    const m = await freshStore();
    m.setRead('b1', { ...read({}), serial: '' });
    const state = m.getAtD890RadioSettingsSession('b1');
    expect(m.isSettingsReadRadio(state, '')).toBe(false);
    expect(m.defaultSettingsChoice(state, '')).toBe('keep');
    expect(m.isSettingsReadRadio(state, '  ')).toBe(false);
    m.setRead('b1', read({}));
    expect(m.isSettingsReadRadio(m.getAtD890RadioSettingsSession('b1'), '')).toBe(false);
  });

  it("preselects Apply for every radio once 'don't ask again' is set", async () => {
    const m = await freshStore();
    m.setRead('b1', read({}));
    m.setApplyToEveryRadio('b1', true);
    expect(m.defaultSettingsChoice(m.getAtD890RadioSettingsSession('b1'), 'SN-OTHER')).toBe(
      'apply',
    );
  });

  it('keeps the stepper ticks, per build', async () => {
    const m = await freshStore();
    m.setStepperTicks('b1', { codeplug: false, contacts: false, settings: true, keps: false });
    expect(m.getAtD890RadioSettingsSession('b1').stepperTicks?.settings).toBe(true);
    m.setStepperTicks('b1', undefined);
    expect(m.getAtD890RadioSettingsSession('b1').stepperTicks).toBeUndefined();
  });
});
