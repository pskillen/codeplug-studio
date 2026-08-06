import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectChipStatus } from './useProjectChipStatus.ts';
import type { ProjectMeta } from '@core/models/project.ts';

const baseProject: ProjectMeta = {
  id: 'p1',
  projectId: 'p1',
  name: 'Demo',
  description: '',
  notes: '',
  author: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  revision: 1,
  interchange: {
    googleDrive: {
      folderId: 'f1',
      fileId: 'file-1',
      fileName: 'demo.yaml',
      exportedAt: '2026-07-09T10:00:00.000Z',
    },
  },
};

describe('useProjectChipStatus', () => {
  it('returns quiet success when synced', () => {
    const { result } = renderHook(() =>
      useProjectChipStatus({
        project: baseProject,
        hasActiveProject: true,
        dirty: false,
        saving: false,
        driveUpdateAvailable: false,
        driveSessionExpired: false,
        driveLinked: true,
      }),
    );

    expect(result.current).toEqual({ tone: 'success', label: null });
  });

  it('returns accent saving label', () => {
    const { result } = renderHook(() =>
      useProjectChipStatus({
        project: baseProject,
        hasActiveProject: true,
        dirty: false,
        saving: true,
        driveUpdateAvailable: false,
        driveSessionExpired: false,
        driveLinked: true,
      }),
    );

    expect(result.current).toEqual({ tone: 'accent', label: 'Saving…' });
  });

  it('returns quiet success when local-only and not dirty', () => {
    const localOnly: ProjectMeta = {
      ...baseProject,
      interchange: undefined,
    };
    const { result } = renderHook(() =>
      useProjectChipStatus({
        project: localOnly,
        hasActiveProject: true,
        dirty: false,
        saving: false,
        driveUpdateAvailable: false,
        driveSessionExpired: false,
        driveLinked: false,
      }),
    );

    expect(result.current).toEqual({ tone: 'success', label: null });
  });

  it('returns unsaved label only when dirty', () => {
    const { result } = renderHook(() =>
      useProjectChipStatus({
        project: baseProject,
        hasActiveProject: true,
        dirty: true,
        saving: false,
        driveUpdateAvailable: false,
        driveSessionExpired: false,
        driveLinked: true,
      }),
    );

    expect(result.current).toEqual({ tone: 'neutral', label: 'Unsaved changes' });
  });

  it('returns warning for drive update', () => {
    const { result } = renderHook(() =>
      useProjectChipStatus({
        project: baseProject,
        hasActiveProject: true,
        dirty: false,
        saving: false,
        driveUpdateAvailable: true,
        driveSessionExpired: false,
        driveLinked: true,
      }),
    );

    expect(result.current.label).toBe('Google Drive update');
    expect(result.current.tone).toBe('warning');
  });
});
