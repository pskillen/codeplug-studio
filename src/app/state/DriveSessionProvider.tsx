import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DriveAuthError,
  DriveCancelledError,
  DriveConfigError,
  getGoogleClientId,
  googleDrivePort,
  handleDriveAuthFailure,
  loadDriveSession,
  msUntilDriveSessionExpiry,
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

export interface DriveSessionContextValue {
  port: GoogleDrivePort;
  connected: boolean;
  accountLabel: string | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  sessionExpired: boolean;
  connect: () => Promise<DriveConnectResult>;
  disconnect: () => Promise<void>;
  refresh: () => void;
  invalidateSession: () => void;
  withDriveAuthRetry: <T>(operation: () => Promise<T>) => Promise<T>;
}

const DriveSessionContext = createContext<DriveSessionContextValue | null>(null);

export interface DriveSessionProviderProps {
  children: ReactNode;
  port?: GoogleDrivePort;
}

export default function DriveSessionProvider({
  children,
  port = googleDrivePort,
}: DriveSessionProviderProps) {
  const [connected, setConnected] = useState(() => port.isConnected());
  const [accountLabel, setAccountLabel] = useState(() => port.getAccountLabel());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConfigured = Boolean(getGoogleClientId());

  const refresh = useCallback(() => {
    const isConnected = port.isConnected();
    setConnected(isConnected);
    setAccountLabel(port.getAccountLabel());
    if (isConnected) {
      setSessionExpired(false);
    }
  }, [port]);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current !== null) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const scheduleExpiryRefresh = useCallback(() => {
    clearExpiryTimer();
    const session = loadDriveSession();
    const msUntilExpiry = msUntilDriveSessionExpiry(session);
    if (msUntilExpiry === null) return;
    if (msUntilExpiry <= 0) {
      refresh();
      if (!port.isConnected()) {
        setSessionExpired(true);
      }
      return;
    }
    expiryTimerRef.current = setTimeout(() => {
      refresh();
      if (!port.isConnected()) {
        setSessionExpired(true);
      }
    }, msUntilExpiry + 50);
  }, [clearExpiryTimer, port, refresh]);

  const invalidateSession = useCallback(() => {
    handleDriveAuthFailure(new DriveAuthError());
    setSessionExpired(true);
    refresh();
  }, [refresh]);

  const connect = useCallback(async (): Promise<DriveConnectResult> => {
    setLoading(true);
    setError(null);
    try {
      await port.connect();
      refresh();
      scheduleExpiryRefresh();
      if (port.isConnected()) {
        setSessionExpired(false);
        return { status: 'connected' };
      }
      return { status: 'failed', message: 'Could not connect to Google Drive.' };
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
  }, [port, refresh, scheduleExpiryRefresh]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await port.disconnect();
      setSessionExpired(false);
      refresh();
    } catch (err) {
      setError(formatDriveError(err));
    } finally {
      setLoading(false);
      clearExpiryTimer();
    }
  }, [clearExpiryTimer, port, refresh]);

  const withDriveAuthRetry = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      try {
        return await operation();
      } catch (err) {
        if (!handleDriveAuthFailure(err)) {
          throw err;
        }
        setSessionExpired(true);
        refresh();
        const result = await connect();
        if (result.status !== 'connected') {
          throw err;
        }
        return await operation();
      }
    },
    [connect, refresh],
  );

  useEffect(() => {
    refresh();
    scheduleExpiryRefresh();
    return clearExpiryTimer;
  }, [clearExpiryTimer, refresh, scheduleExpiryRefresh]);

  useEffect(() => {
    const onFocus = () => {
      refresh();
      scheduleExpiryRefresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refresh, scheduleExpiryRefresh]);

  const value = useMemo<DriveSessionContextValue>(
    () => ({
      port,
      connected,
      accountLabel,
      loading,
      error,
      isConfigured,
      sessionExpired,
      connect,
      disconnect,
      refresh,
      invalidateSession,
      withDriveAuthRetry,
    }),
    [
      port,
      connected,
      accountLabel,
      loading,
      error,
      isConfigured,
      sessionExpired,
      connect,
      disconnect,
      refresh,
      invalidateSession,
      withDriveAuthRetry,
    ],
  );

  return <DriveSessionContext.Provider value={value}>{children}</DriveSessionContext.Provider>;
}

export function useDriveSessionContext(): DriveSessionContextValue {
  const ctx = useContext(DriveSessionContext);
  if (!ctx) {
    throw new Error('useDriveSessionContext must be used within DriveSessionProvider');
  }
  return ctx;
}
