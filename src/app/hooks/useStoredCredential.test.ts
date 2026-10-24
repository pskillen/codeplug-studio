import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useStoredCredential } from './useStoredCredential.ts';

function setup(initial = '') {
  let stored = initial;
  const save = vi.fn((value: string) => {
    stored = value;
  });
  const hook = renderHook(() => useStoredCredential(() => stored, save));
  return { hook, save, read: () => stored };
}

describe('useStoredCredential', () => {
  it('starts clean with the stored value', () => {
    const { hook } = setup('abc');
    expect(hook.result.current.value).toBe('abc');
    expect(hook.result.current.savedValue).toBe('abc');
    expect(hook.result.current.hasSavedValue).toBe(true);
    expect(hook.result.current.isDirty).toBe(false);
  });

  it('tracks a draft as dirty until saved, and trims on save', () => {
    const { hook, save, read } = setup();
    act(() => hook.result.current.setValue('  token  '));
    expect(hook.result.current.isDirty).toBe(true);
    expect(hook.result.current.hasSavedValue).toBe(false);

    act(() => hook.result.current.save());
    expect(save).toHaveBeenCalledWith('token');
    expect(read()).toBe('token');
    expect(hook.result.current.value).toBe('token');
    expect(hook.result.current.hasSavedValue).toBe(true);
    expect(hook.result.current.isDirty).toBe(false);
  });

  it('clear removes the saved value and the draft', () => {
    const { hook, read } = setup('abc');
    act(() => hook.result.current.setValue('abcd'));
    act(() => hook.result.current.clear());
    expect(read()).toBe('');
    expect(hook.result.current.value).toBe('');
    expect(hook.result.current.hasSavedValue).toBe(false);
    expect(hook.result.current.isDirty).toBe(false);
  });
});
