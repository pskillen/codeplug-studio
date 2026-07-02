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

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await port.connect();
      refresh();
    } catch (err) {
      setError(formatDriveError(err));
      refresh();
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
