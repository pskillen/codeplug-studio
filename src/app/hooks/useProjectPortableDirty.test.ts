import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { newProjectMeta, newChannel } from '@core/domain/factories.ts';
import { recordExportDestination } from '@core/services/interchangeMeta.ts';
import { useProjectPortableDirty } from './useProjectPortableDirty.ts';

vi.mock('../state/persistence.ts', async () => {
  const { InMemoryProjectPersistence } = await import('@integrations/persistence/inMemory.ts');
  return { persistence: new InMemoryProjectPersistence() };
});

import { persistence } from '../state/persistence.ts';

describe('useProjectPortableDirty', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not dirty when last edit matches portable sync time', async () => {
    const meta = recordExportDestination(newProjectMeta('Demo'), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: [] });
    const syncedAt = meta.interchange!.googleDrive!.exportedAt;

    const { result } = renderHook(() =>
      useProjectPortableDirty(meta.projectId, {
        ...meta,
        interchange: {
          googleDrive: { ...meta.interchange!.googleDrive!, exportedAt: syncedAt },
        },
      }),
    );

    await waitFor(() => {
      expect(result.current.hasPortableDestination).toBe(true);
      expect(result.current.dirty).toBe(false);
    });
  });

  it('becomes dirty when a library row is newer than portable sync', async () => {
    const meta = recordExportDestination(
      newProjectMeta('Demo'),
      'googleDrive',
      {
        fileName: 'demo.yaml',
        folderId: 'folder-1',
        fileId: 'file-1',
      },
      '2026-01-01T00:00:00.000Z',
    );
    const channel = {
      ...newChannel(meta.projectId, 'Edited'),
      updatedAt: '2099-01-01T00:00:00.000Z',
    };
    await persistence.seedProject({ meta, channels: [channel] });

    const { result } = renderHook(() => useProjectPortableDirty(meta.projectId, meta));

    await waitFor(() => {
      expect(result.current.dirty).toBe(true);
    });
  });

  it('is not dirty after portable sync updates in persistence before React meta refreshes', async () => {
    const baseMeta = newProjectMeta('Demo');
    const persistedMeta = recordExportDestination(
      baseMeta,
      'googleDrive',
      {
        fileName: 'demo.yaml',
        folderId: 'folder-1',
        fileId: 'file-1',
      },
      '2026-07-09T14:04:40.000Z',
    );
    const channel = {
      ...newChannel(persistedMeta.projectId, 'Edited'),
      updatedAt: '2026-07-09T14:04:47.500Z',
    };
    await persistence.seedProject({ meta: persistedMeta, channels: [channel] });

    const { result } = renderHook(() =>
      useProjectPortableDirty(persistedMeta.projectId, persistedMeta),
    );

    await waitFor(() => {
      expect(result.current.dirty).toBe(true);
    });

    const syncedMeta = recordExportDestination(
      persistedMeta,
      'googleDrive',
      {
        fileName: 'demo.yaml',
        folderId: 'folder-1',
        fileId: 'file-1',
      },
      '2026-07-09T14:04:46.000Z',
    );
    const putResult = await persistence.putProjectMeta(syncedMeta, persistedMeta.revision);
    expect(putResult.ok).toBe(true);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.dirty).toBe(false);
    });
  });
});
