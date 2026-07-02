import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIST_NAME_FILTER_DEBOUNCE_MS, useDebouncedNameFilter } from './useDebouncedNameFilter.ts';

describe('useDebouncedNameFilter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates input immediately and commits after debounce', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedNameFilter(committed, commit),
      { initialProps: { committed: '' } },
    );

    act(() => {
      result.current.setNameFilter('hel');
    });
    expect(result.current.nameFilterInput).toBe('hel');
    expect(result.current.nameFilterPending).toBe(true);
    expect(commit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(commit).toHaveBeenCalledWith('hel');

    rerender({ committed: 'hel' });
    expect(result.current.nameFilterPending).toBe(false);
  });

  it('syncs input from external committed changes when not typing', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedNameFilter(committed, commit),
      { initialProps: { committed: '' } },
    );

    rerender({ committed: 'stored' });
    expect(result.current.nameFilterInput).toBe('stored');
  });

  it('does not commit debounced empty input when committed hydrates externally', () => {
    const commit = vi.fn();
    const { rerender } = renderHook(({ committed }) => useDebouncedNameFilter(committed, commit), {
      initialProps: { committed: '' },
    });

    rerender({ committed: 'stored' });

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not restore committed value while a debounced edit is pending', () => {
    const commit = vi.fn();
    const { result, rerender } = renderHook(
      ({ committed }) => useDebouncedNameFilter(committed, commit),
      { initialProps: { committed: 'stored' } },
    );

    act(() => {
      result.current.setNameFilter('');
    });
    expect(result.current.nameFilterInput).toBe('');

    rerender({ committed: 'stored' });
    expect(result.current.nameFilterInput).toBe('');

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(commit).toHaveBeenCalledWith('');
  });
});
