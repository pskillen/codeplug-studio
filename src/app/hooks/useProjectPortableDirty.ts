import { useEffect, useState } from 'react';
import { portableSyncedAt } from '@core/services/interchangeMeta.ts';
import { summariseProjectSeed } from '@core/services/projectSyncSummary.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { persistence } from '../state/persistence.ts';

export interface UseProjectPortableDirtyResult {
  dirty: boolean;
  hasPortableDestination: boolean;
  refresh: () => Promise<void>;
}

export function useProjectPortableDirty(
  projectId: string | null | undefined,
  meta: ProjectMeta | null | undefined,
): UseProjectPortableDirtyResult {
  const [dirty, setDirty] = useState(false);
  const syncedAt = meta ? portableSyncedAt(meta) : null;
  const hasPortableDestination = Boolean(syncedAt);

  async function refresh() {
    if (!projectId || !meta || !syncedAt) {
      setDirty(false);
      return;
    }
    const seed = await persistence.loadProjectSeed(projectId);
    if (!seed) {
      setDirty(false);
      return;
    }
    const summary = summariseProjectSeed(seed);
    const lastModifiedAt = summary.lastModifiedAt;
    setDirty(Boolean(lastModifiedAt && lastModifiedAt > syncedAt));
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!projectId || !meta || !syncedAt) {
        if (!cancelled) setDirty(false);
        return;
      }
      const seed = await persistence.loadProjectSeed(projectId);
      if (cancelled || !seed) {
        if (!cancelled) setDirty(false);
        return;
      }
      const summary = summariseProjectSeed(seed);
      const lastModifiedAt = summary.lastModifiedAt;
      if (!cancelled) {
        setDirty(Boolean(lastModifiedAt && lastModifiedAt > syncedAt));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meta, projectId, syncedAt]);

  useEffect(() => {
    if (!projectId) return;
    return persistence.subscribe((change) => {
      if (change.projectId === projectId) {
        void refresh();
      }
    });
  }, [projectId, meta, syncedAt]);

  return { dirty, hasPortableDestination, refresh };
}
