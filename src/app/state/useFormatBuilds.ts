import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { PutResult } from '@integrations/persistence/index.ts';
import { BuildService } from './buildService.ts';
import { persistence } from './persistence.ts';
import { useProjects } from './useProjects.ts';

/**
 * @deprecated Kept as `useFormatBuilds` to avoid a wide UI rename in #654
 * Slice 2; returns {@link RadioBuild} rows over the new persistence port.
 * Full UI rewiring (egress picker, per-egress export) lands in later slices.
 */
export interface UseFormatBuildsResult {
  projectId: string | null;
  builds: RadioBuild[];
  loading: boolean;
  reload: () => Promise<void>;
  createBuild: (
    radioTargetId: string,
    name?: string,
  ) => Promise<{ ok: true; build: RadioBuild } | { ok: false; reason: string }>;
  putBuild: (build: RadioBuild, expectedRevision: number | null) => Promise<PutResult>;
  deleteBuild: (id: string) => Promise<void>;
}

export function useFormatBuilds(): UseFormatBuildsResult {
  const { activeProjectId } = useProjects();
  const serviceRef = useRef<BuildService | null>(null);
  serviceRef.current ??= new BuildService(persistence);

  const [builds, setBuilds] = useState<RadioBuild[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeProjectId) {
      setBuilds([]);
      return;
    }
    setBuilds(await serviceRef.current!.listBuilds(activeProjectId));
  }, [activeProjectId]);

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      if (!activeProjectId) {
        setBuilds([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const rows = await serviceRef.current!.listBuilds(activeProjectId);
      if (!cancelled) {
        setBuilds(rows);
        setLoading(false);
      }
    };
    void initialLoad();
    const unsubscribe = persistence.subscribe((change) => {
      if (!cancelled && change.projectId === activeProjectId) {
        void reload();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeProjectId, reload]);

  const createBuild = useCallback(
    async (radioTargetId: string, name?: string) => {
      if (!activeProjectId) {
        return { ok: false as const, reason: 'No active project' };
      }
      const outcome = await serviceRef.current!.createBuild(activeProjectId, radioTargetId, name);
      if (outcome.ok) await reload();
      return outcome;
    },
    [activeProjectId, reload],
  );

  const putBuild = useCallback(
    async (build: RadioBuild, expectedRevision: number | null) => {
      const result = await serviceRef.current!.putBuild(build, expectedRevision);
      if (result.ok) await reload();
      return result;
    },
    [reload],
  );

  const deleteBuild = useCallback(
    async (id: string) => {
      if (!activeProjectId) return;
      await serviceRef.current!.deleteBuild(activeProjectId, id);
      await reload();
    },
    [activeProjectId, reload],
  );

  return useMemo(
    () => ({
      projectId: activeProjectId,
      builds,
      loading,
      reload,
      createBuild,
      putBuild,
      deleteBuild,
    }),
    [activeProjectId, builds, loading, reload, createBuild, putBuild, deleteBuild],
  );
}

export function useFormatBuild(id: string | undefined): {
  build: RadioBuild | null;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const { builds, loading, reload } = useFormatBuilds();
  const build = useMemo(
    () => (id ? (builds.find((b) => b.id === id) ?? null) : null),
    [builds, id],
  );
  return { build, loading, reload };
}
