import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useScreenWakeLock } from './useScreenWakeLock.ts';

function fakeWakeLock() {
  const sentinels: { release: ReturnType<typeof vi.fn>; fireRelease: () => void }[] = [];
  const request = vi.fn(async () => {
    let onRelease: (() => void) | undefined;
    const s = {
      release: vi.fn(async () => {}),
      addEventListener: (_type: 'release', listener: () => void) => {
        onRelease = listener;
      },
      fireRelease: () => onRelease?.(),
    };
    sentinels.push(s);
    return s;
  });
  return { request, sentinels };
}

describe('useScreenWakeLock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a no-op when unsupported', () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderHook(() => useScreenWakeLock(true));
    expect(result.current).toEqual({ supported: false, held: false });
  });

  it('requests a screen lock while active and releases it when inactive', async () => {
    const fake = fakeWakeLock();
    vi.stubGlobal('navigator', { wakeLock: { request: fake.request } });
    const { result, rerender } = renderHook(({ active }) => useScreenWakeLock(active), {
      initialProps: { active: false },
    });
    expect(fake.request).not.toHaveBeenCalled();

    rerender({ active: true });
    await waitFor(() => expect(result.current.held).toBe(true));
    expect(fake.request).toHaveBeenCalledWith('screen');

    rerender({ active: false });
    expect(result.current.held).toBe(false);
    expect(fake.sentinels[0]!.release).toHaveBeenCalled();
  });

  it('re-acquires when the tab becomes visible again', async () => {
    const fake = fakeWakeLock();
    vi.stubGlobal('navigator', { wakeLock: { request: fake.request } });
    const { result } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.held).toBe(true));

    // The browser releases the lock when the tab is hidden.
    act(() => fake.sentinels[0]!.fireRelease());
    expect(result.current.held).toBe(false);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(result.current.held).toBe(true));
    expect(fake.request).toHaveBeenCalledTimes(2);
  });

  it('releases on unmount', async () => {
    const fake = fakeWakeLock();
    vi.stubGlobal('navigator', { wakeLock: { request: fake.request } });
    const { result, unmount } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.held).toBe(true));
    unmount();
    expect(fake.sentinels[0]!.release).toHaveBeenCalled();
  });
});
