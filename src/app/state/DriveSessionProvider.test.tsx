import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import DriveSessionProvider, {
  useDriveSessionContext,
} from './DriveSessionProvider.tsx';
import { clearDriveSession, saveDriveSession } from '@integrations/cloud/drivePrefs.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';
import { DriveAuthError } from '@integrations/cloud/index.ts';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

function createPort(overrides: Partial<GoogleDrivePort> = {}): GoogleDrivePort {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    isConnected: vi.fn(() => false),
    getAccountLabel: vi.fn(() => null),
    listChildren: vi.fn(async () => []),
    createFolder: vi.fn(async () => ({
      id: 'f',
      name: 'Folder',
      mimeType: 'application/vnd.google-apps.folder',
    })),
    readFile: vi.fn(async () => ''),
    writeFile: vi.fn(async () => ({ id: 'f', name: 'a.yaml', mimeType: 'application/yaml' })),
    writeBinaryFile: vi.fn(async () => ({ id: 'z', name: 'a.zip', mimeType: 'application/zip' })),
    getFileMetadata: vi.fn(async () => ({
      id: 'f',
      name: 'a.yaml',
      mimeType: 'application/yaml',
    })),
    ...overrides,
  };
}

function wrapper(port: GoogleDrivePort) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <DriveSessionProvider port={port}>{children}</DriveSessionProvider>;
  };
}

describe('DriveSessionProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-id.apps.googleusercontent.com');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearDriveSession();
  });

  it('refresh reflects live port.isConnected after session expiry', async () => {
    let connected = true;
    const port = createPort({
      isConnected: () => connected,
      getAccountLabel: () => (connected ? 'op@example.com' : null),
    });

    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3_600_000,
      accountEmail: 'op@example.com',
    });

    const { result } = renderHook(() => useDriveSessionContext(), { wrapper: wrapper(port) });

    expect(result.current.connected).toBe(true);

    connected = false;
    act(() => {
      result.current.refresh();
    });

    expect(result.current.connected).toBe(false);
  });

  it('invalidateSession clears connected state', () => {
    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3_600_000,
      accountEmail: 'op@example.com',
    });
    const port = createPort({
      isConnected: () => false,
      getAccountLabel: () => null,
    });

    const { result } = renderHook(() => useDriveSessionContext(), { wrapper: wrapper(port) });

    act(() => {
      result.current.invalidateSession();
    });

    expect(result.current.connected).toBe(false);
    expect(result.current.sessionExpired).toBe(true);
  });

  it('withDriveAuthRetry reconnects and retries once', async () => {
    const listChildren = vi
      .fn()
      .mockRejectedValueOnce(new DriveAuthError())
      .mockResolvedValueOnce([{ id: 'f1', name: 'Folder', kind: 'folder' as const }]);

    const port = createPort({
      connect: vi.fn(async () => undefined),
      isConnected: vi.fn(() => true),
      listChildren,
    });

    const { result } = renderHook(() => useDriveSessionContext(), { wrapper: wrapper(port) });

    await act(async () => {
      const items = await result.current.withDriveAuthRetry(() => port.listChildren('root'));
      expect(items).toHaveLength(1);
    });

    expect(port.connect).toHaveBeenCalledOnce();
    expect(listChildren).toHaveBeenCalledTimes(2);
  });

  it('marks sessionExpired when timer fires for expired token', () => {
    vi.useFakeTimers();
    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 30_000,
      accountEmail: 'op@example.com',
    });

    const port = createPort({
      isConnected: vi.fn(() => false),
      getAccountLabel: () => null,
    });

    const { result } = renderHook(() => useDriveSessionContext(), { wrapper: wrapper(port) });

    act(() => {
      vi.advanceTimersByTime(31_000);
    });

    expect(result.current.sessionExpired).toBe(true);
    expect(result.current.connected).toBe(false);

    vi.useRealTimers();
  });
});
