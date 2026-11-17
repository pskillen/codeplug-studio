import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DriveOutgoingReview } from '../services/driveOutgoingReviewService.ts';
import { useDriveSaveFlow } from './useDriveSaveFlow.ts';

const buildDriveOutgoingReview = vi.fn<() => Promise<DriveOutgoingReview>>();
const executeSaveProjectToDrive = vi.fn();

vi.mock('../services/driveOutgoingReviewService.ts', () => ({
  buildDriveOutgoingReview: () => buildDriveOutgoingReview(),
}));
vi.mock('../services/saveProjectToDriveService.ts', () => ({
  executeSaveProjectToDrive: (...args: unknown[]) => executeSaveProjectToDrive(...args),
  recordDrivePortableSyncAfterWrite: vi.fn(),
}));

const drive = { folderId: 'f', fileId: 'file-1', fileName: 'demo.yaml', exportedAt: '' };
const projectsState = {
  activeProjectId: 'p1',
  activeProject: { projectId: 'p1', name: 'Demo', interchange: { googleDrive: drive } },
  refreshProjects: vi.fn(),
};
const driveSession = {
  port: {},
  withDriveAuthRetry: <T,>(op: () => Promise<T>) => op(),
};

vi.mock('../state/useProjects.ts', () => ({ useProjects: () => projectsState }));
vi.mock('./useGoogleDrive.ts', () => ({ useGoogleDrive: () => driveSession }));
vi.mock('./useProjectPortableDirty.ts', () => ({
  useProjectPortableDirty: () => ({ dirty: true, refresh: vi.fn() }),
}));

const review: DriveOutgoingReview = {
  entityChanges: [{ kind: 'channels', id: 'c1', name: 'GB3DA', change: 'added' }],
  changedCounts: [],
  countSummary: '+1 channel',
  remoteModifiedAt: null,
  conflictKinds: [],
};

describe('useDriveSaveFlow reviewOutgoing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the outgoing review without saving', async () => {
    buildDriveOutgoingReview.mockResolvedValue(review);
    const { result } = renderHook(() => useDriveSaveFlow());

    await act(async () => {
      await result.current.reviewOutgoing(drive);
    });

    expect(result.current.outgoingOpen).toBe(true);
    expect(result.current.outgoing).toEqual(review);
    expect(result.current.reviewing).toBe(false);
    expect(executeSaveProjectToDrive).not.toHaveBeenCalled();

    act(() => result.current.closeOutgoing());
    expect(result.current.outgoingOpen).toBe(false);
  });

  it('keeps the review closed and reports a read failure as a review error, not a save error', async () => {
    buildDriveOutgoingReview.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useDriveSaveFlow());

    await act(async () => {
      await result.current.reviewOutgoing(drive);
    });

    expect(result.current.outgoingOpen).toBe(false);
    expect(result.current.reviewError).toBeTruthy();
    expect(result.current.error).toBeNull();
  });
});
