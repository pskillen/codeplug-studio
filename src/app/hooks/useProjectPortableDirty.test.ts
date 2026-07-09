import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
    const meta = recordExportDestination(newProjectMeta('Demo'), 'googleDrive', {
      fileName: 'demo.yaml',
      folderId: 'folder-1',
      fileId: 'file-1',
    });
    await persistence.seedProject({ meta, channels: [] });

    const { result } = renderHook(() => useProjectPortableDirty(meta.projectId, meta));

    await waitFor(() => {
      expect(result.current.dirty).toBe(false);
    });

    await persistence.putChannel(
      {
        ...newChannel(meta.projectId, 'Edited'),
        updatedAt: '2099-01-01T00:00:00.000Z',
      },
      null,
    );
    await waitFor(() => {
      expect(result.current.dirty).toBe(true);
    });
  });
});
