import { useCallback } from 'react';
import type { DriveConnectResult } from './useDriveSession.ts';
import { useGoogleDrive } from './useGoogleDrive.ts';

export function isDriveReady(
  connected: boolean,
  isConfigured: boolean,
  sessionExpired: boolean,
): boolean {
  return connected && isConfigured && !sessionExpired;
}

export interface RunDriveActionWhenReadyParams {
  isConfigured: boolean;
  connected: boolean;
  sessionExpired: boolean;
  connect: () => Promise<DriveConnectResult>;
  onNotConfigured: () => void;
  action: () => void;
}

export type RunDriveActionResult = { ok: true } | { ok: false; connectError?: string };

export async function runDriveActionWhenReady({
  isConfigured,
  connected,
  sessionExpired,
  connect,
  onNotConfigured,
  action,
}: RunDriveActionWhenReadyParams): Promise<RunDriveActionResult> {
  if (!isConfigured) {
    onNotConfigured();
    return { ok: false };
  }

  if (!isDriveReady(connected, isConfigured, sessionExpired)) {
    const result = await connect();
    if (result.status === 'connected') {
      action();
      return { ok: true };
    }
    if (result.status === 'failed') {
      return { ok: false, connectError: result.message };
    }
    return { ok: false };
  }

  action();
  return { ok: true };
}

export interface UseDriveActionClickOptions {
  disabled?: boolean;
  loading?: boolean;
}

export function useDriveActionClick(options: UseDriveActionClickOptions = {}) {
  const {
    connected,
    isConfigured,
    connect,
    loading: driveLoading,
    sessionExpired,
  } = useGoogleDrive();

  const driveReady = isDriveReady(connected, isConfigured, sessionExpired);
  const operationBlocked = Boolean(options.disabled || options.loading || driveLoading);

  const runAction = useCallback(
    async (params: { onNotConfigured: () => void; action: () => void }) => {
      if (operationBlocked) {
        return { ok: false as const };
      }
      return runDriveActionWhenReady({
        isConfigured,
        connected,
        sessionExpired,
        connect,
        onNotConfigured: params.onNotConfigured,
        action: params.action,
      });
    },
    [connected, connect, isConfigured, operationBlocked, sessionExpired],
  );

  return { driveReady, driveLoading, operationBlocked, runAction };
}
