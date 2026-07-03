import { useCallback, useState } from 'react';
import {
  DriveAuthError,
  DriveCancelledError,
  DriveConfigError,
  getGoogleClientId,
  googleDrivePort,
  type GoogleDrivePort,
} from '@integrations/cloud/index.ts';

function formatDriveError(err: unknown): string {
  if (err instanceof DriveCancelledError) return err.message;
  if (err instanceof DriveConfigError) {
    return 'Google Drive is not configured. Set VITE_GOOGLE_CLIENT_ID for local builds.';
  }
  if (err instanceof DriveAuthError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

export type DriveConnectResult =
  | { status: 'connected' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

export function useGoogleDrive(port: GoogleDrivePort = googleDrivePort) {
  const [connected, setConnected] = useState(() => port.isConnected());
  const [accountLabel, setAccountLabel] = useState(() => port.getAccountLabel());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isConfigured = Boolean(getGoogleClientId());

  const refresh = useCallback(() => {
    setConnected(port.isConnected());
    setAccountLabel(port.getAccountLabel());
  }, [port]);

  const connect = useCallback(async (): Promise<DriveConnectResult> => {
    setLoading(true);
    setError(null);
    try {
      await port.connect();
      refresh();
      return port.isConnected() ? { status: 'connected' } : { status: 'failed', message: 'Could not connect to Google Drive.' };
    } catch (err) {
      if (err instanceof DriveCancelledError) {
        refresh();
        return { status: 'cancelled' };
      }
      const message = formatDriveError(err);
      setError(message);
      refresh();
      return { status: 'failed', message };
    } finally {
      setLoading(false);
    }
  }, [port, refresh]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await port.disconnect();
      refresh();
    } catch (err) {
      setError(formatDriveError(err));
    } finally {
      setLoading(false);
    }
  }, [port, refresh]);

  return {
    port,
    connected,
    accountLabel,
    loading,
    error,
    isConfigured,
    connect,
    disconnect,
    refresh,
  };
}
