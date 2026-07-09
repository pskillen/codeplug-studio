import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { newProjectMeta } from '@core/domain/factories.ts';
import { recordExportDestination } from '@core/services/interchangeMeta.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { useProjectPortableDirty } from './useProjectPortableDirty.ts';

vi.mock('../state/persistence.ts', () => ({
  persistence: new InMemoryProjectPersistence(),
}));

import { persistence } from '../state/persistence.ts';

describe('useProjectPortableDirty', () => {
  beforeEach(async () => {
    await (persistence as InMemoryProjectPersistence).clear?.();
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

    const seed = await persistence.loadProjectSeed(meta.projectId);
    const channel = {
      id: 'ch-1',
      projectId: meta.projectId,
      revision: 1,
      updatedAt: '2099-01-01T00:00:00.000Z',
      name: 'Test',
      mode: 'analog' as const,
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      rxTone: null,
      txTone: null,
      power: null,
      squelch: null,
      comment: '',
      abbreviation: '',
      location: null,
      analogContactId: null,
      talkGroupId: null,
      rxGroupListId: null,
      scanListId: null,
    };
    await persistence.putChannel(channel, null);

    await waitFor(() => {
      expect(result.current.dirty).toBe(true);
    });
  });
});
