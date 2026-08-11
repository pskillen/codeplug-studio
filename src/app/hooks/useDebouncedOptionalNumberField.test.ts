import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIST_NAME_FILTER_DEBOUNCE_MS } from '@integrations/listPrefs/index.ts';
import { useDebouncedOptionalNumberField } from './useDebouncedOptionalNumberField.ts';

describe('useDebouncedOptionalNumberField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates input immediately and commits after debounce', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedOptionalNumberField(committed, commit),
      { initialProps: { committed: 3 } },
    );

    act(() => {
      result.current.setValue(2.5);
    });
    expect(result.current.value).toBe(2.5);
    expect(result.current.pending).toBe(true);
    expect(commit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(commit).toHaveBeenCalledWith(2.5);
    expect(result.current.pending).toBe(false);

    rerender({ committed: 2.5 });
    expect(result.current.value).toBe(2.5);
  });

  it('flushes pending edits on blur before debounce elapses', () => {
    const commit = vi.fn();
    const { result } = renderHook(
      ({ committed }) => useDebouncedOptionalNumberField(committed, commit),
      { initialProps: { committed: 3 } },
    );

    act(() => {
      result.current.setValue(4.2);
    });
    act(() => {
      result.current.flush();
    });

    expect(commit).toHaveBeenCalledWith(4.2);
    expect(result.current.value).toBe(4.2);
  });

  it('does not overwrite draft while editing when committed hydrates externally', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedOptionalNumberField(committed, commit),
      { initialProps: { committed: 3 } },
    );

    act(() => {
      result.current.setValue(2.5);
    });
    rerender({ committed: 3 });
    expect(result.current.value).toBe(2.5);

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(commit).toHaveBeenCalledWith(2.5);
  });

  it('syncs input from external committed changes when not editing', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedOptionalNumberField(committed, commit),
      { initialProps: { committed: 3 } },
    );

    rerender({ committed: 4 });
    expect(result.current.value).toBe(4);
  });
});
