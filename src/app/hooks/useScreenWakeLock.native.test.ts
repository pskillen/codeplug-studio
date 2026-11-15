import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  keepAwake: vi.fn(async () => {}),
  allowSleep: vi.fn(async () => {}),
}));

vi.mock('@integrations/platform/isNativeApp.ts', () => ({ isNativeApp: () => true }));
vi.mock('@integrations/platform/keepAwake.ts', () => ({ KeepAwake: native }));

import { useScreenWakeLock } from './useScreenWakeLock.ts';

describe('useScreenWakeLock in the Android app', () => {
  beforeEach(() => {
    native.keepAwake.mockReset().mockResolvedValue(undefined);
    native.allowSleep.mockReset().mockResolvedValue(undefined);
  });

  it('keeps the screen on while active and allows sleep when inactive', async () => {
    const { result, rerender } = renderHook(({ active }) => useScreenWakeLock(active), {
      initialProps: { active: false },
    });
    expect(native.keepAwake).not.toHaveBeenCalled();
    expect(result.current.supported).toBe(true);

    rerender({ active: true });
    await waitFor(() => expect(result.current.held).toBe(true));
    expect(native.keepAwake).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    expect(result.current.held).toBe(false);
    expect(native.allowSleep).toHaveBeenCalledTimes(1);
  });

  it('allows sleep on unmount', async () => {
    const { result, unmount } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(result.current.held).toBe(true));
    unmount();
    expect(native.allowSleep).toHaveBeenCalledTimes(1);
  });

  it('reports not held when the plugin fails, and still releases', async () => {
    native.keepAwake.mockRejectedValue(new Error('no plugin'));
    const { result, unmount } = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(native.keepAwake).toHaveBeenCalled());
    expect(result.current.held).toBe(false);
    unmount();
    expect(native.allowSleep).toHaveBeenCalledTimes(1);
  });

  it('does not let one job release another job lock', async () => {
    const a = renderHook(() => useScreenWakeLock(true));
    const b = renderHook(() => useScreenWakeLock(true));
    await waitFor(() => expect(a.result.current.held && b.result.current.held).toBe(true));

    a.unmount();
    expect(native.allowSleep).not.toHaveBeenCalled();
    expect(b.result.current.held).toBe(true);

    b.unmount();
    expect(native.allowSleep).toHaveBeenCalledTimes(1);
  });
});
