import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { DriveRemoteCheckOutcome } from '../services/driveRemoteCheckService.ts';
import { useRefreshFromDrivePrompt } from './useYamlImportResolver.ts';

const checkDriveRemoteUpdates = vi.fn<() => Promise<DriveRemoteCheckOutcome>>();
const importProjectFromYaml = vi.fn();
const recordProjectImportDestination = vi.fn();
const getFileMetadata = vi.fn();

vi.mock('../services/driveRemoteCheckService.ts', () => ({
  checkDriveRemoteUpdates: () => checkDriveRemoteUpdates(),
}));

vi.mock('../services/projectImportExportService.ts', () => ({
  importProjectFromYaml: (...args: unknown[]) => importProjectFromYaml(...args),
  recordProjectImportDestination: (...args: unknown[]) => recordProjectImportDestination(...args),
}));

const activeProject = {
  projectId: 'p1',
  name: 'Demo',
  interchange: {
    googleDrive: { fileId: 'f1', fileName: 'demo.yaml', folderId: 'root' },
  },
};
const refreshProjects = vi.fn();

vi.mock('../state/useProjects.ts', () => ({ useProjects: () => projectsState }));

// Stable identities: the hook's remote-check effect re-runs when these change.
const driveSession = {
  port: { getFileMetadata },
  withDriveAuthRetry: <T,>(op: () => Promise<T>) => op(),
  connected: true,
};
const projectsState = { activeProject, refreshProjects, switchProject: vi.fn() };

vi.mock('./useGoogleDrive.ts', () => ({ useGoogleDrive: () => driveSession }));

function newer(yaml: string, modifiedTime: string): DriveRemoteCheckOutcome {
  return {
    newer: true,
    diff: {} as never,
    remoteYaml: yaml,
    remoteModifiedTime: modifiedTime,
    remoteProjectId: 'p1',
    idMismatch: false,
  };
}

describe('useRefreshFromDrivePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importProjectFromYaml.mockResolvedValue({ projectId: 'p1' });
  });

  it('re-reads Drive on Review and imports exactly the copy the modal shows', async () => {
    // Banner appears for revision 1; Drive moves on to revision 2 before Review.
    checkDriveRemoteUpdates
      .mockResolvedValueOnce(newer('yaml-rev-1', 't1'))
      .mockResolvedValueOnce(newer('yaml-rev-2', 't2'));

    const { result } = renderHook(() => useRefreshFromDrivePrompt());
    await waitFor(() => expect(result.current.bannerOpen).toBe(true));
    expect(checkDriveRemoteUpdates).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.openOverwrite();
    });
    expect(checkDriveRemoteUpdates).toHaveBeenCalledTimes(2);
    expect(result.current.overwriteOpen).toBe(true);

    await act(async () => {
      await result.current.confirmRefresh();
    });

    expect(importProjectFromYaml).toHaveBeenCalledWith('yaml-rev-2', {
      kind: 'replaceExisting',
      projectId: 'p1',
    });
    // Sync baseline is the imported revision, not a fresh metadata read.
    expect(getFileMetadata).not.toHaveBeenCalled();
    expect(recordProjectImportDestination).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ syncedAt: 't2' }),
    );
  });

  it('does not open the modal when Drive no longer differs on Review', async () => {
    checkDriveRemoteUpdates
      .mockResolvedValueOnce(newer('yaml-rev-1', 't1'))
      .mockResolvedValueOnce({ newer: false });

    const { result } = renderHook(() => useRefreshFromDrivePrompt());
    await waitFor(() => expect(result.current.bannerOpen).toBe(true));

    await act(async () => {
      await result.current.openOverwrite();
    });

    expect(result.current.overwriteOpen).toBe(false);
    expect(result.current.bannerOpen).toBe(false);
  });

  it('keeps the modal closed and shows the error when the re-read fails', async () => {
    checkDriveRemoteUpdates
      .mockResolvedValueOnce(newer('yaml-rev-1', 't1'))
      .mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useRefreshFromDrivePrompt());
    await waitFor(() => expect(result.current.bannerOpen).toBe(true));

    await act(async () => {
      await result.current.openOverwrite();
    });

    expect(result.current.overwriteOpen).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(result.current.checking).toBe(false);
  });
});
