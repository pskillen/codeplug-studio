import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Rt95RadioSettingsRead } from '../services/radioIoRt95SettingsRead.ts';

async function freshStore() {
  vi.resetModules();
  return import('./rt95RadioSettingsSession.ts');
}

function read(decoded: Rt95RadioSettingsRead['decoded']): Rt95RadioSettingsRead {
  return { readAt: 1, bandlimit: 2, decoded };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RT95 radio settings session store', () => {
  it('starts empty in a fresh module instance', async () => {
    const a = await freshStore();
    a.setOverride('b1', 'beepVolume', 2);
    expect(a.getRt95RadioSettingsSession('b1').overrides.size).toBe(1);
    const b = await freshStore();
    expect(b.getRt95RadioSettingsSession('b1').overrides.size).toBe(0);
  });

  it('sets, clears and lists overrides in field display order', async () => {
    const m = await freshStore();
    m.setOverride('b1', 'displayMode', 1);
    m.setOverride('b1', 'beepVolume', 2);
    expect(m.overridesForWrite('b1')).toEqual([
      { fieldId: 'displayMode', value: 1 },
      { fieldId: 'beepVolume', value: 2 },
    ]);
    m.clearOverride('b1', 'beepVolume');
    expect(m.overridesForWrite('b1')).toEqual([{ fieldId: 'displayMode', value: 1 }]);
    m.clearAllOverrides('b1');
    expect(m.overridesForWrite('b1')).toEqual([]);
  });

  it('copyAllFromRead only touches basic fields with a decoded value', async () => {
    const m = await freshStore();
    m.setOverride('b1', 'scanType', 1);
    m.setRead(
      'b1',
      read({
        beepVolume: { value: 3, raw: [3] },
        scanType: { value: undefined, raw: [9], label: 'Unknown' },
        powerOnPasswordEnabled: { value: true, raw: [1] },
      }),
    );
    m.copyAllFromRead('b1');
    expect(Object.fromEntries(m.getRt95RadioSettingsSession('b1').overrides)).toEqual({
      scanType: 1,
      beepVolume: 3,
    });
  });

  it('turning advanced off drops advanced overrides', async () => {
    const m = await freshStore();
    m.setShowAdvanced('b1', true);
    m.setOverride('b1', 'trfEnable', true);
    m.setOverride('b1', 'beepVolume', 1);
    m.setShowAdvanced('b1', false);
    const s = m.getRt95RadioSettingsSession('b1');
    expect(s.showAdvanced).toBe(false);
    expect(s.overrides.has('trfEnable')).toBe(false);
    expect(s.overrides.get('beepVolume')).toBe(1);
  });

  it('counts the password pair once', async () => {
    const m = await freshStore();
    m.setPowerOnPassword('b1', '123456');
    expect(m.rt95OverrideCount(m.getRt95RadioSettingsSession('b1').overrides)).toBe(1);
  });

  it('react hook updates on change', async () => {
    const m = await freshStore();
    const { result } = renderHook(() => m.useRt95RadioSettingsSession('b1'));
    expect(result.current.overrides.size).toBe(0);
    act(() => m.setOverride('b1', 'voxOnOff', true));
    expect(result.current.overrides.get('voxOnOff')).toBe(true);
  });
});
