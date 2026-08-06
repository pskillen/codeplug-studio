import { useCallback, useEffect, useState } from 'react';
import { portableSyncedAt } from '@core/services/interchangeMeta.ts';
import { isProjectPortableDirtyFromSeed } from '@core/services/projectSyncSummary.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { persistence } from '../state/persistence.ts';

export interface UseProjectPortableDirtyResult {
  dirty: boolean;
  hasPortableDestination: boolean;
  refresh: () => Promise<void>;
}

async function evaluatePortableDirty(projectId: string): Promise<boolean> {
  const seed = await persistence.loadProjectSeed(projectId);
  if (!seed) return false;
  return isProjectPortableDirtyFromSeed(seed);
}

export function useProjectPortableDirty(
  projectId: string | null | undefined,
  meta: ProjectMeta | null | undefined,
): UseProjectPortableDirtyResult {
  const [dirty, setDirty] = useState(false);
  const syncedAt = meta ? portableSyncedAt(meta) : null;
  const hasPortableDestination = Boolean(syncedAt);

  const refresh = useCallback(async () => {
    if (!projectId || !syncedAt) {
      setDirty(false);
      return;
    }
    setDirty(await evaluatePortableDirty(projectId));
  }, [projectId, syncedAt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!projectId || !syncedAt) {
        if (!cancelled) setDirty(false);
        return;
      }
      const nextDirty = await evaluatePortableDirty(projectId);
      if (!cancelled) setDirty(nextDirty);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, syncedAt]);

  useEffect(() => {
    if (!projectId) return;
    return persistence.subscribe((change) => {
      if (change.projectId === projectId) {
        void refresh();
      }
    });
  }, [projectId, refresh]);

  return { dirty, hasPortableDestination, refresh };
}
