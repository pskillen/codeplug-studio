import { describe, expect, it, vi } from 'vitest';
import * as platform from '../../integrations/platform/isNativeApp.ts';
import type { DriveConnectResult } from './useDriveSession.ts';
import { isDriveReady, runDriveActionWhenReady } from './useDriveActionClick.ts';

describe('isDriveReady', () => {
  it('is false when session expired even if connected', () => {
    expect(isDriveReady(true, true, true)).toBe(false);
  });

  it('is true when connected, configured, and session valid', () => {
    expect(isDriveReady(true, true, false)).toBe(true);
  });
});

describe('runDriveActionWhenReady', () => {
  it('runs connect then action when session expired', async () => {
    const action = vi.fn();
    const connect = vi.fn(async (): Promise<DriveConnectResult> => ({ status: 'connected' }));

    const result = await runDriveActionWhenReady({
      isConfigured: true,
      connected: true,
      sessionExpired: true,
      connect,
      onNotConfigured: vi.fn(),
      action,
    });

    expect(connect).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
  });

  it('connects on native when not yet connected', async () => {
    vi.spyOn(platform, 'isNativeApp').mockReturnValue(true);
    const action = vi.fn();
    const connect = vi.fn(async (): Promise<DriveConnectResult> => ({ status: 'connected' }));

    const result = await runDriveActionWhenReady({
      isConfigured: true,
      connected: false,
      sessionExpired: false,
      connect,
      onNotConfigured: vi.fn(),
      action,
    });

    expect(connect).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true });
  });
});
